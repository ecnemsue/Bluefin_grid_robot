# Bluefin_grid_robot
A simple grid strategy trading robot working upon Bluefin in Sui network. This program was written in TypeScript based on bluefin-v2-client, and one should formulate your custodian account and adjust the file config_blue.json before running. These codes were made intended to learn interactions around bluefin, comments and improvements are welcome!  

Text format for the file config_blue.json:
<code>
"symbol":"SUI-PERP",// the trading pair for this bot
"mnemonic":"trigger swim reunion gate hen black real deer light nature trial dust",  // your wallet seed phrase
  "lowerprice": 0.707,  //the lowest price for the bot running
  "gridnum": 65,  // the total number of grids
  "amount": 70,  //the amount each one grid will trade
  "pricegap": 0.004,  //smallest price difference between grids
  "sleepperiod": 2500, //loop period =2.5s
  "leverage":3, //perp leverage
  "close_all_when_out_range":1,//close all positions when price is out of range
  "equi_ratio_mode":0, // 1= shift to equivalent ratio grids mode
  "priceratiogap":1.004,// price ratio between each grid in equivalent ratio grids mode
</code>



Suika.sui
