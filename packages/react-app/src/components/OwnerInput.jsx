import {DeleteOutlined, UserAddOutlined} from "@ant-design/icons";
import {Badge, Button, Input, List, notification} from "antd";
import React, { useCallback, useState } from "react";
import { ethers } from "ethers";
import Blockie from "./Blockie";

export default function OwnerInput(props) {
  const [value, setValue] = useState([]);
  const [address, setAddress] = useState("");
  const [threshold, setThreshold] = useState("");

  const addAccountButton = (
    <div
      style={{ marginTop: 4, cursor: "pointer" }}
      onClick={() => {
        const checksumAddress = ethers.utils.getAddress(address);
        if (value.indexOf(checksumAddress) > -1) {
          setAddress("");
          return;
        }
        try {
          setValue([...value, checksumAddress])
          setAddress("");
        } catch (e) {
          notification.open({
            message: "🛑 Error Adding Owner",
            description: (
              <>
                {e.toString()} (check console)
              </>
            ),
          });
        }
      }}
    >
      <Badge count={<UserAddOutlined style={{ fontSize: 9, marginRight: 2 }} />}>
      </Badge>{" "}
      Add Owner
    </div>
  );

  const removeAccountButton = (
    <div>
      <Badge count={<DeleteOutlined style={{ fontSize: 18 }} />}>
      </Badge>{" "}
    </div>
  );

  const removeAccount = (address) => {
    const newValue = value.filter((item) => {
      return item !== address
    })
    setValue(newValue);
  }

  const { onDeploy, loading } = props;

  return (
    <div>
      <List
        size="small"
        header={<div>Owners</div>}
        bordered
        locale={{emptyText: "No Owner"}}
        dataSource={value}
        renderItem={item =>
          <List.Item actions={[<Button value={item} onClick={ item => removeAccount(item.currentTarget.value) }>{removeAccountButton}</Button>]}>
            <List.Item.Meta
              avatar={<Blockie address={item} size={8} scale={3} />}
              title={`${item.substring(0, 6)}...${item.substr(item.length - 4)}`}
            />
          </List.Item>
        }
      />
      <Input style={{ marginTop: 4 }}
        id="addAddress" // name it something other than address for auto fill doxxing
        name="addAddress" // name it something other than address for auto fill doxxing
        autoComplete="off"
        autoFocus={props.autoFocus}
        placeholder={props.placeholder ? props.placeholder : "address"}
        prefix={<Blockie address={address} size={8} scale={3} />}
        value={address}
        onChange={async e => {
          const newValue = e.target.value;
          setAddress(newValue);
        }}
        addonAfter={addAccountButton}
      />
      <Input style={{ marginTop: 4 }}
         id="safeThreshold" // name it something other than address for auto fill doxxing
         name="safeThreshold" // name it something other than address for auto fill doxxing
         autoComplete="off"
         autoFocus={props.autoFocus}
         placeholder={"Safe Threshold. E.g. 2"}
         onChange={async e => {
           const newValue = e.target.value;
           setThreshold(parseInt(newValue));
         }}
      />
      <Button loading={loading} onClick={() => {
        if (value.length < threshold) {
          notification.open({
            message: "🛑 Error Deploying",
            description: (
              <>
                {"Threshold is greater than the number of owners"}
              </>
            ),
          });
        }
        onDeploy(value, threshold)}
      } type={"primary"} >
        DEPLOY SAFE
      </Button>
    </div>
  );
}
