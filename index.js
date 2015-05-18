///////////////////////////////////////////////////////////////////////////////
// Programming Challenge
// Use Case:
// Joe wants to send <1000 litecoin> to each of his three kids none of which
// have a litecoin wallet.  They have each requested that he send them coin
// in their favorite currencies  <Startcoin>, <Dogecoin>, <Nubits>.  Joe
// wants to get the best rates possible when he converts the coins to give
// his children.
// Write a web app using nodejs that will find out what the best exchanges
// would be for each of these trades. The app should talk to the api's of
// several crypto-exchanges to get real data.
//////////////////////////////////////////////////////////////////////////////

var request = require('request');
var _ = require('underscore');
var async = require('async');
var math = require('mathjs');
math.config({
    number: 'bignumber', // Default type of number: 'number' (default) or 'bignumber'
    precision: 64        // Number of significant digits for BigNumbers
});
var bleutrade = "https://bleutrade.com/api/v2/public/getorderbook"
var hitbtcdoge = "https://api.hitbtc.com/api/1/public/DOGEBTC/orderbook"
var hitbtcltc = "https://api.hitbtc.com/api/1/public/LTCBTC/orderbook"
var cpLTCDOGE="LTC_DOGE"
var cpDOGELTC="DOGE_LTC"

var bleuoptssell = {
  url : bleutrade,
  qs : { market : cpDOGELTC, type : "SELL", depth:1000}
}

var bleuoptsbuy = {
  url : bleutrade,
  qs : { market : cpLTCDOGE, type : "BUY", depth:1000}
}

var hitopts_ltcbtc = {
  url : hitbtcltc
}

var hitopts_dogebtc = {
  url : hitbtcdoge
}

var BANK_ROLL = 1000;

hitBtc(BANK_ROLL);
bleuTrade(BANK_ROLL);

function hitBtc(bankroll) {
  function normalizeTerminology(data) {
    var normalizedData = {}
    normalizedData.sell=_.map(data.asks, function(ask){
      var scope = { quantity : ask[1], 
                    price : ask[0] 
                  } 
      math.eval('cost = number(quantity) * number(price)', scope)
      return { cost :  scope.cost,
               gain : scope.quantity,
               ratio : math.eval('string(number(quantity) / cost)', scope),
               rate : scope.price,
               quantity : scope.quantity,
               type:"SELL"
             }
    })
    normalizedData.buy = _.map(data.bids, function(bid){
      var scope = { quantity : bid[1], 
                    price : bid[0] 
                  } 
      math.eval('gain = number(quantity) * number(price)', scope)
      return { cost : scope.quantity,
               gain : scope.gain,
               ratio : math.eval('string(gain / number(quantity))', scope),
               rate : scope.price,
               quantity : scope.quantity,
               type:"BUY"
             }
    })
    
    return normalizedData;
  }
  function calculate(results, bankroll, type){
    var all =_.sortBy(results[type], 'ratio').reverse();
    var total = { cost : 0, gain:0 }
    _.each(all, function(data) {
      var tempTotal = total.cost+math.number(data.cost)
      data.picked = false;
      if(tempTotal>bankroll)  return;
      total.cost=tempTotal;
      total.gain+=math.number(data.gain);
      data.picked = true;
    });
    return total;
  }
  async.series({
    dogebtc : function(cb){
      request(hitopts_dogebtc, function(error, response, body){   
        var data=normalizeTerminology(JSON.parse(body));
        cb(null, data);
      })
    },
    ltcbtc: function(cb){
      request(hitopts_ltcbtc, function(error, response, body){   
        var data=normalizeTerminology(JSON.parse(body));
        cb(null, data);
      })
    }
  }, function (err, results) {
    var total_ltcbtc=calculate(results.ltcbtc, bankroll, 'buy')
    var total_dogebtc=calculate(results.dogebtc, total_ltcbtc.gain, 'sell')
    var summary = { Exchange : 'HitExchange' }
    summary.LTCBTC = total_ltcbtc;
    summary.DOGEBTC = total_dogebtc;
    //    console.log(JSON.stringify(_.sortBy(results.ltcbtc.buy, 'rate'),null, 4))
    //    console.log(JSON.stringify(results.dogebtc.sell,null, 4))
    console.log(JSON.stringify(summary, null, 4));
  })
}

function bleuTrade(bankroll) {
  async.parallel({
    sell : function(cb){
      request(bleuoptssell, function(error, response, body){   
        var data=JSON.parse(body);
        var calc = _.map(data.result.sell, function(order,index,list){
          var cost = parseFloat(order.Rate)*parseFloat(order.Quantity)
          return { cost : cost,
                   gain : parseFloat(order.Quantity),
                   ratio : parseFloat(order.Quantity)/cost,
                   rate : parseFloat(order.Rate), 
                   quantity : parseFloat(order.Quantity),
                   type : "SELL"
                 }
        });
        calc = _.filter(_.sortBy(calc, 'rate'), function(data) {
          return data.cost <= 1000
        });
        cb(null, calc)
      })
    },
    buy : function(cb){
      request(bleuoptsbuy, function(error, response, body){   
        var data=JSON.parse(body);
        var calc = _.map(data.result.buy, function(order,index,list){
          var gain = parseFloat(order.Rate)*parseFloat(order.Quantity)
          return { gain : gain, 
                   cost : parseFloat(order.Quantity),
                   ratio : gain/parseFloat(order.Quantity),
                   rate : parseFloat(order.Rate), 
                   quantity : parseFloat(order.Quantity),
                   type : "BUY"
                 }
        });
        calc = _.filter(_.sortBy(calc, 'rate').reverse(), function(data) {
          return data.quantity <= 1000
        });
        cb(null, calc)
      })
    }
  }, function (err, results) {
    var all =_.sortBy(results.buy.concat(results.sell), 'ratio').reverse();
    function calculate(bankroll) {
      var total = { cost : 0, gain:0 }
      _.each(all, function(data) {
        var tempTotal = total.cost+data.cost
        data.picked = false;
        if(tempTotal>bankroll) return;
        total.cost=tempTotal;
        total.gain+=data.gain;
        data.picked = true;
      });
      return total;
    }
    var total = calculate(bankroll);    
    var summary = { Exchange : 'BleuExchange' }
    summary.DOGELTC_LTCDOGE = total
    console.log(summary);
  })

}