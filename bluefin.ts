/**
 * Create an order signature on chain and returns it. The signature is used to verify
 * during on-chain trade settlement whether the orders being settled against each other
 * were actually signed on by the maker/taker of the order or not.
 */

/* eslint-disable no-console */
import {
  ORDER_STATUS,
  MARKET_SYMBOLS,
  ORDER_SIDE,
  ORDER_TYPE,
  toBaseNumber,
  MinifiedCandleStick,
  Faucet,
  OrderSigner,
  parseSigPK,
  ADJUST_MARGIN,
  Networks, 
  BluefinClient
} from "@bluefin-exchange/bluefin-v2-client";
import { setTimeout } from 'timers/promises';
import configFile from './config_blue.json';


function fixed(int, n=4,):number{

return Number(int.toFixed(n));

}

async function main() {
  // no gas fee is required to create order signature.
  const dummyAccountKey =configFile.mnemonic;//  "trigger swim reunion gate hen black real deer light nature trial dust";

  const client = new BluefinClient(
    true,
    Networks.PRODUCTION_SUI,  //running in mainnet
    dummyAccountKey,
    "ED25519" //valid values are ED25519 or Secp256k1
  ); // passing isTermAccepted = true for compliance and authorization
await client.init();
let symbol = configFile.symbol;
var BidPrice=0;
var AskPrice=0; 
try{ 
let resp=  await client.getOrderbook({
    symbol: symbol,
    limit: 10,
  });
 BidPrice=fixed(Number(resp.data.bestBidPrice)*10**(-18));
 AskPrice=fixed(Number(resp.data.bestAskPrice)*10**(-18));
  console.log('BidPrice:'+BidPrice+',AskPrice:'+AskPrice);
}
catch (e:any){
    console.log(e,'Error at getting price')
	 return;
} 
const lowerprice = configFile.lowerprice;//网格运行最低价格
const gridnum = configFile.gridnum;//网格数量
const amount = configFile.amount;//每网格下单的SUI的数量
const pricegap = configFile.pricegap;//相邻网格之间的价差
const upperprice=lowerprice+gridnum*pricegap;//网格运行最高价格
const sleepperiod = configFile.sleepperiod;//loop period：2.5s
const leverage=configFile.leverage;// setting your trade leverage
const close_all_when_out_range=configFile.close_all_when_out_range; 
var freeUSDC=0;
var init_accountValue=0;



await client.adjustLeverage({
    symbol:symbol,
    leverage: leverage,
  });




try{ 
//await client.cancelAllOpenOrders(symbol);
let account = (await client.getUserAccountData()).data;
 freeUSDC= fixed(Number(account.freeCollateral)*10**(-18));
 init_accountValue=fixed(Number(account.accountValue)*10**(-18));
console.log(account);
}
catch (e:any){
    console.log(e,'Error at getting account data')
	 return;
} 

let order_list=await client.getUserOrders({
  statuses: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL_FILLED]
});

if (order_list.data.length>0){
await client.cancelAllOpenOrders(symbol);
console.log("All open orders have been canceled.");await setTimeout(500);
}


console.log('free collateral in account:'+freeUSDC +' USDC');

const resp1 = (await client.getExchangeInfo(symbol)).data;
const dem=19-(resp1.minOrderSize).length;
const price_decimals=19-(resp1.tickSize).length;
await setTimeout(200);
if (((lowerprice+upperprice)*amount*gridnum)/2 > freeUSDC*leverage*0.98){
console.log('Error: your free collateral is not enough for running this bot. It needs '+((lowerprice+upperprice)*gridnum*amount*1.02/(2*leverage))+' USDC at your leverage '+leverage+'x .');
 return;
}

if (BidPrice<lowerprice | BidPrice> upperprice){
console.log('Current price is out of range:'+'['+lowerprice+','+upperprice+'], stop running')
 return;
}

if (((BidPrice-lowerprice)*Math.floor((BidPrice-lowerprice)/pricegap+1)*amount)/2>freeUSDC | ((upperprice-BidPrice)*Math.floor((upperprice-BidPrice)/pricegap+1)*amount)/2>freeUSDC){
console.log('Warnning: your liquidation price is lying whthin bot running range, please reduce your leverage and amount');

}


let i=0;
var volume=0;
var loopcount=0;
var orderstates:number[] = new Array(gridnum).fill(0);
var mev:number[] = new Array(gridnum).fill(0);
var order_Hash:String[] = new Array(gridnum).fill('0');

/*
let resp= await client.getUserOrders({
  statuses: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL_FILLED]
}
*/



await setTimeout(1000);

while (i<gridnum){
await setTimeout(200);
if (lowerprice+i*pricegap<BidPrice & lowerprice+i*pricegap>BidPrice*0.9){
try {
let res=await client.postOrder({
    symbol: symbol,
	clientId: i.toString(),
    price: fixed(lowerprice+i*pricegap,price_decimals),
    quantity: fixed(amount,dem),
    side: ORDER_SIDE.BUY,
    orderType: ORDER_TYPE.LIMIT,
    leverage: leverage,
    });
	if (res.ok==true){
	orderstates[i]=1;
	}else{
	console.log(res);
	}
  } catch (e) {
    console.log("Error:", e);
  }
}
if (lowerprice+i*pricegap>AskPrice & lowerprice+i*pricegap<AskPrice*1.1){
try {
await client.postOrder({
    symbol: symbol,
	clientId: i.toString(),
    price: fixed(lowerprice+i*pricegap,price_decimals),
    quantity: fixed(amount,dem),
    side: ORDER_SIDE.SELL,
    orderType: ORDER_TYPE.LIMIT,
    leverage: leverage,
    });
	orderstates[i]=-1;
  } catch (e) {
    console.log("Error:", e);
  }	
}
i+=1;
}
console.log('Grid orders created successfully, range ['+lowerprice+','+upperprice+'], grid number:'+gridnum+', each grid trade amount:'+amount+', price gap:'+pricegap);
await setTimeout(2000);
 order_list=(await client.getUserOrders({
  statuses: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL_FILLED]
})).data;
const re = /(\w+)\s(\w+)/; 
let list_index=0;
while (list_index<order_list.length){
let str=order_list[list_index].clientId;
let newstr = (str.split(" ",2))[1];
order_Hash[Number(newstr)]=order_list[list_index].hash;
list_index+=1;
}

await setTimeout(3000);

var flag=0;
var lastfinishnum=-1;
while (true){
try{ 
let resp=  await client.getOrderbook({
    symbol: symbol,
    limit: 10,
  });
  
 BidPrice=fixed(Number(resp.data.bestBidPrice)*10**(-18));
 AskPrice=fixed(Number(resp.data.bestAskPrice)*10**(-18));
  console.log('BidPrice:'+BidPrice+',AskPrice:'+AskPrice);
}
catch (e:any){
    console.log(e,'Network error at getting price');
	BidPrice=0;
	AskPrice=0;
}
let flag_fin=0;

if (BidPrice>0 & (BidPrice<lowerprice | BidPrice> upperprice)){
console.log('Current price is out of range:'+'['+lowerprice+','+upperprice+'], stop running');
if (close_all_when_out_range==1){
	await client.cancelAllOpenOrders(symbol);
	let pos = (await client.getUserPosition({ symbol: symbol})).response.data;
	let qty= fixed(Number(pos.quantity)*10**(-18),dem);
	await client.postOrder({
		symbol: symbol,
		quantity: qty,
		side: BidPrice<lowerprice? ORDER_SIDE.SELL:ORDER_SIDE.BUY,
		orderType: ORDER_TYPE.MARKET,
		leverage: leverage,
	});
	 return;
}
}


if (BidPrice>lowerprice-pricegap & AskPrice<upperprice+pricegap){
	i=0;
	while (i<gridnum){
		if ((lowerprice+i*pricegap<AskPrice & orderstates[i]==-1)| ( orderstates[i]==1 & lowerprice+i*pricegap>BidPrice)|(order_Hash[i]=='0' & orderstates[i]!=0 & lowerprice+i*pricegap<AskPrice*1.07 & lowerprice+i*pricegap>BidPrice*0.93)){
		volume+=amount*(lowerprice+i*pricegap);
		console.log((orderstates[i]==1?"Bid Order:":"Ask Order:")+(lowerprice+i*pricegap)+", Id="+order_Hash[i]+" has been finished, total volume:"+volume);
		orderstates[i]=0;
		flag_fin=1;
		if (Math.abs(lowerprice+i*pricegap-BidPrice)<Math.abs(lastfinishnum-BidPrice)| flag_fin==0){
			lastfinishnum=i;
		}
		}
		if (orderstates[i]==0 & i!=lastfinishnum & i+1<gridnum & (BidPrice-lowerprice-i*pricegap>pricegap| BidPrice-lowerprice-i*pricegap>pricegap*0.4 &orderstates[i+1]==0)& lowerprice+i*pricegap>BidPrice*0.9){
		  try {
			await setTimeout(500);
			let res = await client.postOrder({
				symbol: symbol,
				clientId: i.toString(),
				price: fixed(lowerprice+i*pricegap,price_decimals),
				quantity: fixed(amount,dem),
				side: ORDER_SIDE.BUY,
				orderType: ORDER_TYPE.LIMIT,
				leverage: leverage,
			});
			orderstates[i]=1;
			order_Hash[i]='unknown';
			console.log("Pleaced Bid Order:"+(lowerprice+i*pricegap)+", current best bid price:"+BidPrice);
			if (res.ok==false){
			console.log(res);
			}
			flag=1;
		  } catch (e) {
			console.log("Error:", e);
		  }
		}
		if (orderstates[i]==0 & i!=lastfinishnum   & i-1>=0 & ((lowerprice+i*pricegap-AskPrice>pricegap)| (lowerprice+i*pricegap-AskPrice>pricegap*0.4 & orderstates[i-1]==0)) & lowerprice+i*pricegap<AskPrice*1.1){
		 try {
			await setTimeout(500);
			await client.postOrder({
				symbol: symbol,
				clientId: i.toString(),
				price: fixed(lowerprice+i*pricegap,price_decimals),
				quantity: fixed(amount,dem),
				side: ORDER_SIDE.SELL,
				orderType: ORDER_TYPE.LIMIT,
				leverage: leverage,
			});
			orderstates[i]=-1;
			order_Hash[i]='unknown';
			console.log("Pleaced Ask Order:"+(lowerprice+i*pricegap)+", current best ask price:"+AskPrice);
			flag=1;
		 } catch (e) {
			console.log("Error:", e);
		  }
			
		}
	i+=1;
	}
	
}

if (flag==1 | loopcount%30==0){
//Updated OrderIds
	try{
		 order_list=(await client.getUserOrders({
		  statuses: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL_FILLED]
		})).data;
		let list_index=0;
		order_Hash = new Array(gridnum).fill('0');
		while (list_index<order_list.length){
		let str=order_list[list_index].clientId;
		let newstr = (str.split(" ",2))[1];
		order_Hash[Number(newstr)]=order_list[list_index].hash;
		list_index+=1;
		}
		}catch (e:any){
				console.log(e,'Error at getting account data')
				
		} 
		if(loopcount%90==0){
		
			console.log("Updated OrderIds :");
			console.table(order_list,['clientId','orderStatus','side','price','filledQty','hash']);
			
		//Updated account balances
		try{ 
			await setTimeout(500);
			let account = (await client.getUserAccountData()).data;
			let freeUSDC= fixed(Number(account.freeCollateral)*10**(-18));
			let accountValue=fixed(Number(account.accountValue)*10**(-18));
			let date: Date = new Date();
			console.log('Total account value:'+accountValue+' , profit :'+ fixed(accountValue-init_accountValue)+', freeCollateral:'+fixed(freeUSDC)+', at '+date.toLocaleString());	
			}
			catch (e:any){
				console.log(e,'Error at getting account data')
				
			} 
		}

}
flag=0;
loopcount+=1;
await setTimeout(sleepperiod);
}
}

main().then().catch(console.warn);
