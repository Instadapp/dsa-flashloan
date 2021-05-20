module.exports = {
  "COMPOUND-A": [
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogBorrow",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogDeposit",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "cTokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogDepositCToken",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "borrower",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "tokenToPay",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "tokenInReturn",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogLiquidate",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogPayback",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogWithdraw",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "cToken",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "cTokenAmt",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "LogWithdrawCToken",
      type: "event",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "borrow",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "borrowRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "deposit",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "depositCToken",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "depositCTokenRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "depositRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "borrower", type: "address" },
        { internalType: "string", name: "tokenIdToPay", type: "string" },
        { internalType: "string", name: "tokenIdInReturn", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "liquidate",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "borrower", type: "address" },
        { internalType: "address", name: "tokenToPay", type: "address" },
        { internalType: "address", name: "cTokenPay", type: "address" },
        { internalType: "address", name: "tokenInReturn", type: "address" },
        { internalType: "address", name: "cTokenColl", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "liquidateRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [],
      name: "name",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "payback",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "paybackRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "withdraw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "tokenId", type: "string" },
        { internalType: "uint256", name: "cTokenAmt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "withdrawCToken",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "cTokenAmt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "withdrawCTokenRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address", name: "cToken", type: "address" },
        { internalType: "uint256", name: "amt", type: "uint256" },
        { internalType: "uint256", name: "getId", type: "uint256" },
        { internalType: "uint256", name: "setId", type: "uint256" },
      ],
      name: "withdrawRaw",
      outputs: [
        { internalType: "string", name: "_eventName", type: "string" },
        { internalType: "bytes", name: "_eventParam", type: "bytes" },
      ],
      stateMutability: "payable",
      type: "function",
    },
  ],
  "INSTAPOOL-V2": [
    {
      inputs: [
        {
          internalType: "address",
          name: "_instaPool",
          type: "address",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
      ],
      name: "LogFlashBorrow",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address[]",
          name: "token",
          type: "address[]",
        },
        {
          indexed: false,
          internalType: "uint256[]",
          name: "tokenAmts",
          type: "uint256[]",
        },
      ],
      name: "LogFlashMultiBorrow",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address[]",
          name: "token",
          type: "address[]",
        },
        {
          indexed: false,
          internalType: "uint256[]",
          name: "tokenAmts",
          type: "uint256[]",
        },
      ],
      name: "LogFlashMultiPayback",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "tokenAmt",
          type: "uint256",
        },
      ],
      name: "LogFlashPayback",
      type: "event",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amt",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes",
        },
      ],
      name: "flashBorrowAndCast",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amt",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "getId",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "setId",
          type: "uint256",
        },
      ],
      name: "flashPayback",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [],
      name: "instaPool",
      outputs: [
        {
          internalType: "contract InstaFlashV2Interface",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ],
};
