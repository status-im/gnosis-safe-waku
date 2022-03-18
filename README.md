# Gnosis Safe with Waku Network

This project replaces Gnosis Transaction History Service with Waku Network to achieve fully decentralization.

Waku is a decentralized network and family of protocols that allow censorship-resistant, private, peer-to-peer communication. It is the infrastructure backbone of the Status app, a Web3 decentralized messenger app. The JavaScript implementation of Waku, js-waku, enables dApps and webapps to utilize the Waku network for off-chain message transmission.

### Implementation Detail

This project integrates Waku network to gnosis for initiating gnosis multi-party multi-signature transactions. In detail, when an owner of a safe initiates a safe transaction, the transaction data will be broadcasting to the Waku network with **symmetric encryption**, instead of sending to the centralized Gnosis Transaction History Service. When other owners want to confirm this transaction, if other owners are online, the transaction data will be sent to them directly using **Waku relay**. On the other hand, if other owners are offline, the transaction data will be sent to the **Waku store** for them to pull when they are online.

The content topic is versioned so that this workflow can be upgraded anytime.

See https://youtu.be/NoglkQAL7Mc for a simple demonstration.

### Installation

```sh
git clone -b gnosis-starter-kit https://github.com/Soptq/gnosis-safe-waku.git gnosis-safe-waku

cd gnosis-safe-waku

yarn install

yarn start
```

> 👉 Visit your frontend at http://localhost:3000


## Deployment

> 📡 deploy a safe using the frontend or enter an existing safe address:

> ( ⛽️ Grab **Rinkeby** from the [faucet](https://faucet.rinkeby.io/) )

![image](https://user-images.githubusercontent.com/2653167/129985013-b3562b2c-88b5-4180-9bbe-379808eb4267.png)

---

> 📝 Edit `GnosisStarterView.jsx` in `packages/react-app/src/views` to change the deploy parameters.

![image](https://user-images.githubusercontent.com/2653167/130370221-8f3c55c4-fe74-4e1a-b472-e2d4f1fa7428.png)


(Setup *two* browsers with different addresses and add them both as `OWNERS` with a `THRESHOLD` of **2**.)

---

> Deploy the safe in one browser and paste it into the second browser:

![image](https://user-images.githubusercontent.com/2653167/130370279-34b5424f-f08a-4f76-8880-793c57d1b14b.png)

---

> Send some Rinkeby to your Safe by copying the address and using the 'wallet icon' in the top right:

![image](https://user-images.githubusercontent.com/2653167/130370297-0425ede2-846c-4d5e-b71a-4c3a6790ce77.png)

![image](https://user-images.githubusercontent.com/2653167/130370307-34763ae1-4b2a-466b-89cd-08b5751c72ba.png)

---

> Propose a transaction that sends funds vitalik.eth:

![image](https://user-images.githubusercontent.com/2653167/130370336-89288eeb-be94-49e1-8e39-eaf608002e40.png)


---

> The second browser can then sign the second signature:

![image](https://user-images.githubusercontent.com/2653167/130370374-0dc87367-ebff-4e4c-9820-c54ed1a9df95.png)


---

> After the threshold of signatures is met, anyone can execute the transacation:

![image](https://user-images.githubusercontent.com/2653167/130370390-5d083f06-178f-409f-9706-42498aed8cec.png)

---

> Check the multisig balance to make sure the funds were sent:

![image](https://user-images.githubusercontent.com/2653167/130370436-47eb5ef2-9e57-4539-af29-a4ee277214e7.png)


---


## Support

Please don't hesitate to open issues.
