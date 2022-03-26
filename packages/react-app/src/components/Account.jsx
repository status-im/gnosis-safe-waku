import {Button, Dropdown, Menu} from "antd";
import React from "react";
import { useThemeSwitcher } from "react-css-theme-switcher";
import Address from "./Address";
import Balance from "./Balance";
import Wallet from "./Wallet";
import {DownOutlined} from "@ant-design/icons";

/*
  ~ What it does? ~

  Displays an Address, Balance, and Wallet as one Account component,
  also allows users to log in to existing accounts and log out

  ~ How can I use? ~

  <Account
    address={address}
    localProvider={localProvider}
    userProvider={userProvider}
    mainnetProvider={mainnetProvider}
    price={price}
    web3Modal={web3Modal}
    loadWeb3Modal={loadWeb3Modal}
    logoutOfWeb3Modal={logoutOfWeb3Modal}
    blockExplorer={blockExplorer}
  />

  ~ Features ~

  - Provide address={address} and get balance corresponding to the given address
  - Provide localProvider={localProvider} to access balance on local network
  - Provide userProvider={userProvider} to display a wallet
  - Provide mainnetProvider={mainnetProvider} and your address will be replaced by ENS name
              (ex. "0xa870" => "user.eth")
  - Provide price={price} of ether and get your balance converted to dollars
  - Provide web3Modal={web3Modal}, loadWeb3Modal={loadWeb3Modal}, logoutOfWeb3Modal={logoutOfWeb3Modal}
              to be able to log in/log out to/from existing accounts
  - Provide blockExplorer={blockExplorer}, click on address and get the link
              (ex. by default "https://etherscan.io/" or for xdai "https://blockscout.com/poa/xdai/")
*/

export default function Account({
  address,
  userSigner,
  localProvider,
  mainnetProvider,
  price,
  minimized,
  web3Modal,
  loadWeb3Modal,
  logoutOfWeb3Modal,
  blockExplorer,
}) {
  const modalButtons = [];
  if (web3Modal) {
    if (web3Modal.cachedProvider) {
      modalButtons.push(
        <Button
          key="logoutbutton"
          style={{ verticalAlign: "top", marginLeft: 8, marginTop: 4 }}
          shape="round"
          size="large"
          onClick={logoutOfWeb3Modal}
        >
          logout
        </Button>,
      );
    } else {
      modalButtons.push(
        <Button
          key="loginbutton"
          style={{ verticalAlign: "top", marginLeft: 8, marginTop: 4 }}
          shape="round"
          size="large"
          /* type={minimized ? "default" : "primary"}     too many people just defaulting to MM and having a bad time */
          onClick={loadWeb3Modal}
        >
          connect
        </Button>,
      );
    }
  }

  const { currentTheme } = useThemeSwitcher();

  const display = minimized ? (
    ""
  ) : (
    <span>
      {address ? (
        <Address address={address} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
      ) : (
        "Connecting..."
      )}
      <Balance address={address} provider={localProvider} price={price} />
      <Wallet
        address={address}
        provider={localProvider}
        signer={userSigner}
        ensProvider={mainnetProvider}
        price={price}
        color={currentTheme === "light" ? "#1890ff" : "#2caad9"}
      />
    </span>
  );

  const getChainURL = (chain) => {
    return window.location.origin + "?chain=" + chain
  }

  const menu = (
    <Menu>
      <Menu.Item key="0">
        <a href={getChainURL(1)}>Mainnet</a>
      </Menu.Item>
      <Menu.Item key="1">
        <a href={getChainURL(4)}>Rinkeby</a>
      </Menu.Item>
      <Menu.Item key="2">
        <a href={getChainURL(5)}>Goerli</a>
      </Menu.Item>
      <Menu.Item key="3">
        <a href={getChainURL(10)}>Optimism</a>
      </Menu.Item>
      <Menu.Item key="4">
        <a href={getChainURL(100)}>Xdai</a>
      </Menu.Item>
      <Menu.Item key="5">
        <a href={getChainURL(137)}>Polygon</a>
      </Menu.Item>
      <Menu.Item key="6">
        <a href={getChainURL(42161)}>Arbitrum</a>
      </Menu.Item>
    </Menu>
  );

  return (
    <div>
      {display}
      <Dropdown overlay={menu} trigger={['click']}>
        <a className="ant-dropdown-link" onClick={e => e.preventDefault()}>
          Select Chains <DownOutlined />
        </a>
      </Dropdown>,
      {modalButtons}
    </div>
  );
}
