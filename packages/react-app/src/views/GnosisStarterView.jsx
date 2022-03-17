import { Button, Card, DatePicker, Divider, Input, List, Progress, Slider, Spin, Switch, notification } from "antd";
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Address, Balance, EtherInput, AddressInput } from "../components";
import { usePoller, useLocalStorage, useBalance, useSafeSdk } from "../hooks";
import { EthSignSignature } from './EthSignSignature'
import WalletConnect from "@walletconnect/client";
import { Waku, WakuMessage, utils } from "js-waku";
import { keccak256 } from "ethers/lib/utils";
import protons from "protons";
import {hexToBytes} from "js-waku/build/main/lib/utils";

// Waku message format
const proto = protons(`
message WakuSafeMessage {
  required string txHash = 1;  
  repeated WakuSafeSignature signatures = 2;
  required WakuSafeTransactionData transactionData = 3;
  optional uint64 done = 4;
  optional string version = 5;
}

message WakuSafeSignature {
  required string signer = 1;
  required string signature = 2;
}

message WakuSafeTransactionData {
  required string to = 1;
  required string value = 2;
  required string data = 3;
  required uint64 operation = 4;
  required uint64 safeTxGas = 5;
  required uint64 baseGas = 6;
  required uint64 gasPrice = 7;
  required string gasToken = 8;
  required string refundReceiver = 9;
  required uint64 nonce = 10;
}
`);
const VERSION = "v1.2"; // Bump this version if you want to ignore all previous messages sent to Waku network.

export default function GnosisStarterView({
  userSigner,
  address,
  mainnetProvider,
  localProvider,
  price,
  blockExplorer,
  targetNetwork
}) {
  const [to, setTo] = useState('')
  const [threshold, setThreshold] = useState(0)
  const [owners, setOwners] = useState([])
  const [transactions, setTransactions] = useState([])
  const [value, setValue] = useState(0)
  const [selector, setSelector] = useState('')
  const [params, setParams] = useState([])
  const [data, setData] = useState('0x00')
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState("None");

  const OWNERS = [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
    "0xa81a6a910FeD20374361B35C451a4a44F86CeD46"
  ]
  const THRESHOLD = 2

  const [safeAddress, setSafeAddress] = useLocalStorage("deployedSafe")
  const [ deploying, setDeploying ] = useState()
  const safeBalance = useBalance(localProvider, safeAddress);
  const { safeSdk, safeFactory } = useSafeSdk(userSigner, safeAddress)

  const isSafeOwnerConnected = owners.includes(address)

  useEffect(() => {
    if (!safeAddress) return;
    // If Waku status is Connected, return
    if (wakuStatus === "Connected") return;
    // If Waku status is None, it means we need to start Waku;
    if (!waku || wakuStatus === "None") {
      setWakuStatus("Starting");
      const contentTopic = `/gnosis-safe/1/${safeAddress}/proto` // prepare our content topic;
      // Create Waku
      Waku.create({
        bootstrap: { default: true },
        decryptionKeys: [utils.hexToBytes(
          keccak256(Buffer.from(contentTopic, "utf-8"))
        )]
      }).then((waku) => {
        // Once done, put it in the state
        setWaku(waku);
        // And update the status
        setWakuStatus("Connecting");
      });
    }

    // If Waku status is Connecting, it means we need to wait for the Waku peers to be ready;
    if (wakuStatus === "Connecting") {
      waku.waitForRemotePeer().then(() => {
        setWakuStatus("Connected");
      });
    }
  }, [waku, wakuStatus, safeAddress]);

  const wakuLightPush = useCallback(async (message, contentTopic) => {
    console.log("Waku Light Push:", message);
    const encodedMessage = encodeWakuSafeSignatureMsg(message);
    const wakuMessage = await WakuMessage.fromBytes(encodedMessage, contentTopic, {
      symKey: hexToBytes(
        keccak256(Buffer.from(contentTopic, "utf-8"))
      )
    });
    const ack = await waku.lightPush.push(wakuMessage);
    if (!ack?.isSuccess) {
      notification.open({
        message: "🛑 Error Proposing Transaction To Waku Network",
        description: (
          <>
            {message.toString()} (check console)
          </>
        ),
      });
    }
  }, [waku]);

  const deploySafe = useCallback(async (owners, threshold) => {
    if (!safeFactory) return
    setDeploying(true)
    const safeAccountConfig = { owners, threshold }
    let safe
    try {
      safe = await safeFactory.deploySafe(safeAccountConfig)
    } catch (error) {
      console.error(error)
      setDeploying(false)
      return
    }
    const newSafeAddress = ethers.utils.getAddress(safe.getAddress())
    setSafeAddress(newSafeAddress)
  }, [safeFactory])

  const proposeSafeTransaction = useCallback(async (transaction) => {
    if (!safeSdk) return
    let safeTransaction
    try {
      safeTransaction = await safeSdk.createTransaction(transaction)
    } catch (error) {
      console.error(error)
      return
    }
    console.log('SAFE TX', safeTransaction)
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction)
    console.log('HASH', safeTxHash)
    const safeSignature = await safeSdk.signTransactionHash(safeTxHash)

    // Here we send our signature message to the Waku network;
    const contentTopic = `/gnosis-safe/1/${safeAddress}/proto` // prepare our content topic;
    const message = {
      txHash: safeTxHash,
      signatures: [{
        signer: safeSignature.signer,
        signature: safeSignature.data
      }],
      transactionData: {
        to: safeTransaction.data.to,
        value: safeTransaction.data.value,
        data: safeTransaction.data.data || '0x',
        operation: safeTransaction.data.operation,
        safeTxGas: safeTransaction.data.safeTxGas,
        baseGas: safeTransaction.data.baseGas,
        gasPrice: Number(safeTransaction.data.gasPrice),
        gasToken: safeTransaction.data.gasToken,
        refundReceiver: safeTransaction.data.refundReceiver,
        nonce: safeTransaction.data.nonce
      },
      done: 0,
      version: VERSION,
    }
    await wakuLightPush(message, contentTopic);
  }, [safeSdk, safeAddress])

  const confirmTransaction = useCallback(async (transaction) => {
    if (!safeSdk) return;
    const hash = transaction.txHash;
    let signature;
    try {
      signature = await safeSdk.signTransactionHash(hash);
    } catch (error) {
      console.error(error);
      return;
    }
    const newMessage = transaction;
    newMessage.signatures.push({signer: signature.signer, signature: signature.data});
    const contentTopic = `/gnosis-safe/1/${safeAddress}/proto` // prepare our content topic;
    await wakuLightPush(newMessage, contentTopic);
  }, [safeSdk, safeAddress])

  const executeSafeTransaction = useCallback(async (transaction) => {
    if (!safeSdk) return
    const safeTransactionData = transaction.transactionData;
    const safeTransaction = await safeSdk.createTransaction(safeTransactionData)
    transaction.signatures.forEach(confirmation => {
      const signature = new EthSignSignature(confirmation.signer, confirmation.signature)
      safeTransaction.addSignature(signature)
    })
    let executeTxResponse
    try {
      executeTxResponse = await safeSdk.executeTransaction(safeTransaction)
    } catch(error) {
      console.error(error)
      return
    }
    const receipt = executeTxResponse.transactionResponse && (await executeTxResponse.transactionResponse.wait())
    console.log(receipt)
    const newMessage = transaction;
    newMessage.done = 1;
    const contentTopic = `/gnosis-safe/1/${safeAddress}/proto` // prepare our content topic;
    await wakuLightPush(newMessage, contentTopic);
  }, [safeSdk])

  const isTransactionExecutable = (transaction) => transaction.signatures.length >= threshold

  const isTransactionSignedByAddress = (transaction) => {
    const confirmation = transaction.signatures.find(signature => signature.signer === address)
    return !!confirmation
  }

  const encodeWakuSafeSignatureMsg = useCallback((wakuMessage) => {
    return proto.WakuSafeMessage.encode(wakuMessage)
  }, []);

  const decodeAndProcessWakuSafeSignatureMsg = useCallback((wakuMessage) => {
    if (!wakuMessage.payload) return;

    const { txHash, signatures, transactionData, done, version } = proto.WakuSafeMessage.decode(
      wakuMessage.payload
    );

    // All fields in protobuf are optional so be sure to check
    if (!txHash || !signatures || !transactionData) return;
    const transaction = {
      txHash: txHash,
      signatures: signatures,
      transactionData: transactionData,
      done: done,
      version: version,
    };
    if (typeof transaction.version === 'undefined' || transaction.version !== VERSION)
      return // drop messages with different version
    console.log("Waku Message Decoded:", transaction);
    // update messages with the same txHash
    let duplicatedTransactions = transactions.filter(tx => tx.txHash === transactions.txHash);
    console.log("Updating", duplicatedTransactions.length, "Messages");
    for (const duplicatedTransaction of duplicatedTransactions) {
      // merge signatures
      for (const oldSignature of duplicatedTransaction.signatures) {
        const signatureNotIncluded = (
          transaction.signatures.filter(
            signature => signature.signer === oldSignature.signer
          )
        ).length === 0;
        if (signatureNotIncluded) transaction.signatures.push(oldSignature);
      }
    }
    // delete outdated transactions
    let memTransactions = transactions.filter(tx => tx.txHash !== transaction.txHash);
    memTransactions.push(transaction);
    // delete done message
    memTransactions = memTransactions.filter(tx => typeof tx.done !== 'undefined' && tx.done === 0);
    console.log("mem", memTransactions);
    setTransactions(memTransactions);
  }, []);

  React.useEffect(() => {
    if (!waku) return;

    const contentTopic = `/gnosis-safe/1/${safeAddress}/proto` // prepare our content topic;

    // Pass the content topic to only process messages related to your dApp
    waku.relay.addObserver(decodeAndProcessWakuSafeSignatureMsg, [contentTopic]);

    if (wakuStatus === "Connected") {
      console.log("Loading messages from Waku Store");
      const processWakuStoreMessages = (retrievedMessages) => {
        retrievedMessages.map(decodeAndProcessWakuSafeSignatureMsg).filter(Boolean);
      };
      waku.store
        .queryHistory([contentTopic], { callback: processWakuStoreMessages })
        .catch((e) => {
          console.log("Failed to retrieve messages", e);
        });
    }

    // `cleanUp` is called when the component is unmounted, see ReactJS doc.
    return function cleanUp() {
      waku.relay.deleteObserver(decodeAndProcessWakuSafeSignatureMsg, [contentTopic]);
    };
  }, [waku, wakuStatus, decodeAndProcessWakuSafeSignatureMsg, safeAddress]);

  usePoller(async () => {
    if(safeAddress){
      try{
        if(safeSdk){
          const owners = await safeSdk.getOwners()
          const threshold = await safeSdk.getThreshold()
          setOwners(owners)
          setThreshold(threshold)
        }
      }catch(e){
        console.log("ERROR POLLING FROM SAFE:",e)
      }
    }
  },3333);

  const [ walletConnectUrl, setWalletConnectUrl ] = useState()
  const [ connected, setConnected ] = useState()

  useEffect(()=>{
    //walletConnectUrl
    if(walletConnectUrl){
      const connector = new WalletConnect(
        {
          // Required
          uri: walletConnectUrl,
          // Required
          clientMeta: {
            description: "Gnosis Safe Starter Kit",
            url: "https://github.com/austintgriffith/scaffold-eth/tree/gnosis-starter-kit",
            icons: ["http://s3.amazonaws.com/pix.iemoji.com/images/emoji/apple/ios-12/256/owl.png"],
            name: "Gnosis Safe Starter Kit",
          },
        }/*,
        {
          // Optional
          url: "<YOUR_PUSH_SERVER_URL>",
          type: "fcm",
          token: token,
          peerMeta: true,
          language: language,
        }*/
      );

      // Subscribe to session requests
      connector.on("session_request", (error, payload) => {
        if (error) {
          throw error;
        }

        console.log("SESSION REQUEST")
        // Handle Session Request

        connector.approveSession({
          accounts: [                 // required
            safeAddress
          ],
          chainId: targetNetwork.chainId               // required
        })

        setConnected(true)


        /* payload:
        {
          id: 1,
          jsonrpc: '2.0'.
          method: 'session_request',
          params: [{
            peerId: '15d8b6a3-15bd-493e-9358-111e3a4e6ee4',
            peerMeta: {
              name: "WalletConnect Example",
              description: "Try out WalletConnect v1.0",
              icons: ["https://example.walletconnect.org/favicon.ico"],
              url: "https://example.walletconnect.org"
            }
          }]
        }
        */
      });

      // Subscribe to call requests
      connector.on("call_request", (error, payload) => {
        if (error) {
          throw error;
        }

        console.log("REQUEST PERMISSION TO:",payload,payload.params[0])
        // Handle Call Request
        console.log("SETTING TO",payload.params[0].to)
        setTo(payload.params[0].to)
        setData(payload.params[0].data?payload.params[0].data:"0x0000")
        setValue(payload.params[0].value)
        /* payload:
        {
          id: 1,
          jsonrpc: '2.0'.
          method: 'eth_sign',
          params: [
            "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
            "My email is john@doe.com - 1537836206101"
          ]
        }
        */
        /*connector.approveRequest({
          id: payload.id,
          result: "0x41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a"
        });*/

      });

      connector.on("disconnect", (error, payload) => {
        if (error) {
          throw error;
        }
        console.log("disconnect")

        // Delete connector
      });
    }
  },[ walletConnectUrl ])


  let safeInfo
  if(safeAddress){
    safeInfo = (
      <div>
        <Address value={safeAddress} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
        <Balance value={safeBalance} price={price} />

        <div style={{padding:8}}>
        {owners&&owners.length>0?(
          <>
            <b>Waku Status:</b>
            <p>{wakuStatus}</p>
            <b>Signers:</b>
            <List
              bordered
              dataSource={owners}
              renderItem={item => {
                return (
                  <List.Item key={item + "_ownerEntry"}>
                    <Address address={item} ensProvider={mainnetProvider} fontSize={12} />
                  </List.Item>
                );
              }}
            />
          </>
        ):<Spin/>}

        </div>
      </div>
    )
  }else{
    safeInfo = (
      <div style={{padding:32}}>
        <Button loading={deploying} onClick={() => deploySafe(OWNERS, THRESHOLD)} type={"primary"} >
          DEPLOY SAFE
        </Button>
        <div> or enter existing address: </div>
        <AddressInput ensProvider={mainnetProvider} onChange={(addr)=>{
          if(ethers.utils.isAddress(addr)){
            console.log("addr!",addr)

            setSafeAddress(ethers.utils.getAddress(addr))
          }
        }}/>
      </div>
    )
  }




  let proposeTransaction
  if(!safeAddress){
    proposeTransaction = ""
  } else if(!owners || owners.length<=0){
    proposeTransaction = ""
  }else if(owners.includes(address)){
    proposeTransaction = (
      <>
        <Divider />

        {connected?"✅":""}<Input
          style={{width:"70%"}}
          placeholder={"wallet connect url"}
          value={walletConnectUrl}
          disabled={connected}
          onChange={(e)=>{
            setWalletConnectUrl(e.target.value)
          }}
        />{connected?<span onClick={()=>{setConnected(false);}}>X</span>:""}

        <Divider />
        <h5>Propose Transaction:</h5>

        <div style={{ margin: 8}}>
          <div style={{ padding: 4 }}>
            <AddressInput placeholder="Enter To Address"
              onChange={setTo}
              ensProvider={mainnetProvider}
              value={to}
              onChange={setTo}
            />
          </div>
          <div style={{ padding: 4 }}>
            <EtherInput
              autofocus
              price={price}
              placeholder="Enter Tx Value"
              value={value}
              /*
              onChange={v => {
                v = v && v.toString && v.toString()
                if(v){
                  const valueResult = ethers.utils.parseEther(""+v.replace(/\D/g, ""))
                  setValue(valueResult);
                }

              }}*/
              onChange={setValue}
            />
          </div>
          <div style={{ padding: 4 }}>
            <Input placeholder="Enter Selector i.e add(uint, uint)"
              onChange={async (e) => {
                setSelector(e.target.value)
              }}
            />
          </div>
          <div style={{ padding: 4 }}>
            <Input placeholder="Enter arguments separated by ,"
              onChange={async (e) => {
                setParams(e.target.value.split(','))
              }}
            />
          </div>
          {data?data:""}
          <Button
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (selector !== '' && params.length > 0) {
                const abi = [
                  "function " + selector
                ];
                const index = selector.indexOf('(');
                const fragment = selector.substring(0, index)

                const iface = new ethers.utils.Interface(abi);
                for (let i = 0; i < params.length; i++) {
                  if (iface.fragments[0].inputs[i].baseType.includes('uint') || iface.fragments[0].inputs[i].baseType.includes('int')) {
                    params[i] = parseInt(params[i])
                  }
                }
                const data = iface.encodeFunctionData(fragment, params);
                setData(data)
              }

              const checksumForm = ethers.utils.getAddress(to)
              const partialTx = {
                to: checksumForm,
                data,
                value: ethers.utils.parseEther(value ? Number(value).toString() : "0").toString()
              }
              try{
                await proposeSafeTransaction(partialTx)
              }catch(e){
                console.log("🛑 Error Proposing Transaction",e)
                notification.open({
                  message: "🛑 Error Proposing Transaction",
                  description: (
                    <>
                      {e.toString()} (check console)
                    </>
                  ),
                });
              }

            }}
          >
            Sign Transaction
          </Button>

        </div>
      </>
    )
  }

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        {safeAddress?<div style={{float:"right", padding:4, cursor:"pointer", fontSize:28}} onClick={()=>{
          setSafeAddress("")
          setTransactions([])
        }}>
          x
        </div>:""}

        <div style={{padding:64}}>
          {safeInfo}
        </div>

        {proposeTransaction}

      </div>
      <Divider />
      <div style={{ margin: 8 }}>
        {
          transactions.length > 0 && transactions.map((transaction) => {

            let buttonDisplay = ""

            if(!owners || owners.length<=0){
              buttonDisplay = (
                <Spin/>
              )
            }else if(!isTransactionExecutable(transaction)){
              if(isSafeOwnerConnected && !isTransactionSignedByAddress(transaction)){
                buttonDisplay = (
                  <Button
                    style={{ marginTop: 8 }}
                    onClick={() => confirmTransaction(transaction)}
                  >
                  Sign TX</Button>
                )
              }else{
                buttonDisplay = "Waiting for more signatures..."
              }
            }else{
              if(isSafeOwnerConnected && isTransactionExecutable(transaction)){
                buttonDisplay = (
                  <Button
                    style={{ marginTop: 8 }}
                    onClick={() => executeSafeTransaction(transaction)}
                  >Execute TX</Button>
                )
              } else {
                buttonDisplay = "Waiting to execute..."
              }
            }


            return (
              <div style={{borderBottom:"1px solid #ddd"}}>
                {console.log("transaction", transaction)}
                <h1>#{transaction.transactionData.nonce}</h1>
                <Address value={transaction.transactionData.to} ensProvider={mainnetProvider} />
                <p>Data: {transaction.transactionData.data}</p>
                <p>Value: {ethers.utils.formatEther(transaction.transactionData.value)} ETH</p>
                <div style={{padding:32}}>
                  {buttonDisplay}
                </div>
              </div>
            )
          })
        }
      </div>
      <div style={{padding:64,margin:64}}><a href="https://github.com/austintgriffith/scaffold-eth/tree/gnosis-starter-kit" target="_blank">🏗</a></div>
    </div>
  );
}
