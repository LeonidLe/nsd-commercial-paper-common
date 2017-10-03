/**
 * Created by maksim on 8/16/17.
 */

const util = require('util');

module.exports = {
  getBlockInstructions  : getBlockInstructions,
  getInstructionsByEvent  : getInstructionsByEvent,
  getTransactionChannel : getTransactionChannel,
  getTransactionType  : getTransactionType,
  getBlockActionEvent : getBlockActionEvent,
  instruction2string  : instruction2string,
  position2string     : position2string,
  instructionFilename : instructionFilename,
  instructionArguments: instructionArguments,
  normalizeInstruction: normalizeInstruction,
  // getRoleInInstruction: getRoleInInstruction,
  isBilateralChannel  : isBilateralChannel,

  ConfigHelper : ConfigHelper
}


const TYPE_ENDORSER_TRANSACTION = 'ENDORSER_TRANSACTION';


/**
 * convert new instruction format (key, value) into old one. Multiple calls has no effect
 * @param {Instruction}
 */
function normalizeInstruction(instruction){
  if(instruction.key && instruction.value){
    instruction = Object.assign({}, instruction.key, instruction.value);
  }
  return instruction;
}

// /**
//  *
//  */
// function getRoleInInstruction(instruction, deponentCode){
//   if(instruction.deponentFrom == deponentCode){
//     return 'transferer';
//   }else if(instruction.deponentTo == deponentCode){
//     return 'receiver';
//   }
//   return null;
// }

/**
 * Determine whether it's a channel between two members (and nsd is always here).
 * Actually, should be called "threeLateral"
 * @return {boolean}
 */
function isBilateralChannel(channelID){
    return channelID.indexOf('-') > 0 && !channelID.startsWith('nsd-');
}


/**
 *
 */
function getInstructionsByEvent(block){
  var result = {}; // eventName => array of Instructions

  block.data.data.forEach(function(blockData){

    var blockType = getTransactionType(blockData);
    var channel   = getTransactionChannel(blockData);
    var type      = getTransactionType(blockData);

    if (type === TYPE_ENDORSER_TRANSACTION) {

      blockData.payload.data.actions.forEach(function(action) {

        var event = getBlockActionEvent(action)||{};
        var eventName = event.event_name || 'default';
        result[eventName] = result[eventName] || [];

        var payload = Buffer.from(event.payload, 'base64').toString();
        // var payload = event.payload.toString();

        try{
          payload = JSON.parse(payload);
        }catch(e){
          // it's ok, can be not a json
        }

        result[eventName].push({
          channel_id  : channel,
          type    : blockType,
          payload : payload
        });

      }); // thru action elements
    }
  }); // thru block data elements
  return result;
}

/**
 * Transform block to simplier represntation
 * return array of {channel_id:string, instruction:Instruction}
 */
function getBlockInstructions(block, eventName){
  var result = [];

  block.data.data.forEach(function(blockData){

    var blockType = getTransactionType(blockData);
    var channel   = getTransactionChannel(blockData);
    var type      = getTransactionType(blockData);

    if (type === TYPE_ENDORSER_TRANSACTION) {

      blockData.payload.data.actions.forEach(function(action) {

        var event = getBlockActionEvent(action)||{};

        if(event.event_name === eventName) {
          var payload = Buffer.from(event.payload, 'base64').toString();
          // var payload = event.payload.toString();

          try{
            payload = JSON.parse(payload);
          }catch(e){
            // it's ok, can be not a json
          }


          result.push({
            channel_id  : channel,
            type    : blockType,
            payload : payload
          });
        }

      }); // thru action elements
    }
  }); // thru block data elements
  return result;
}


function getTransactionType(blockData) {
  return blockData.payload.header.channel_header.type;
}


function getTransactionChannel(blockData) {
  return blockData.payload.header.channel_header.channel_id;
}

function getBlockActionEvent(blockDataAction) {
  return blockDataAction.payload.action.proposal_response_payload.extension.events;
}




/**
 *
 */
function instruction2string(instruction){
  // var instruction = this;
  return util.format('Instruction: %s/%s -> %s/%s (%s)',
    instruction.transferer.account,
    instruction.transferer.division,


    instruction.receiver.account,
    instruction.receiver.division,

    // instruction.security,
    // instruction.quantity,
    instruction.reference

    // instruction.instructionDate,
    // instruction.tradeDate
  );
}


/**
 *
 */
function instructionFilename(instruction){
  return util.format('%s-%s-%s-%s-%s-%s-%s-%s-%s',
    instruction.security,

    instruction.transferer.account,
    instruction.transferer.division,

    instruction.receiver.account,
    instruction.receiver.division,

    instruction.quantity,
    instruction.reference,
    instruction.instructionDate.replace(/-/g, ''),
    instruction.tradeDate.replace(/-/g, '')
  );
}




/**
 *
 */
function position2string(position){
  return util.format('Position: %s/%s (%s of %s)',
    position.balance.account,
    position.balance.division,
    position.quantity,
    position.security
  );
}





/**
 * return basic fields for any instruction request
 * @static
 * @return {Array<string>}
 */
function instructionArguments(instruction) {
  var args = [
    instruction.transferer.account,  // 0: accountFrom
    instruction.transferer.division, // 1: divisionFrom

    instruction.receiver.account,    // 2: accountTo
    instruction.receiver.division,   // 3: divisionTo

    instruction.security,            // 4: security
    ''+instruction.quantity,         // 5: quantity
    instruction.reference,           // 6: reference
    instruction.instructionDate,     // 7: instructionDate
    instruction.tradeDate,           // 8: tradeDate
  ];

  return args;
}


/**
 * @class ConfigHelper
 */
function ConfigHelper(config){
  this.accountConfig = config['account-config'];
  this.networkConfig = config['network-config'];
}


/**
 *
 */
ConfigHelper.prototype.getInstructionChannel = function(instruction){
  let deponentFrom = instruction.deponentFrom || this.getDepcodeByAccount(instruction.transferer.account, instruction.transferer.division);
  let org1 = this.getOrgByDepcode(deponentFrom);
  if(!org1) {
    throw new Error('Cannot find org by deponent ' + deponentFrom);
  }

  let deponentTo = instruction.deponentTo || this.getDepcodeByAccount(instruction.receiver.account, instruction.receiver.division);
  let org2 = this.getOrgByDepcode(deponentTo);
  if(!org2) {
    throw new Error('Cannot find org by deponent ' + deponentTo);
  }
  return [org1, org2].sort().join('-');
};

/**
 * get organosation ID by deponent code (1 to 1 matching)
 * @param  {srting} depCode
 * @return {srting} orgID
 */
ConfigHelper.prototype.getOrgByDepcode = function(depCode){
  // looking for second participant
  for(var org in this.accountConfig){
    if(this.accountConfig.hasOwnProperty(org)){
      if(this.accountConfig[org].dep == depCode){
        return org;
        // break;
      }
    }
  }
  return null;
};


/**
 * get organisation ID by deponent code (1 to 1 matching)
 * @param  {srting} account
 * @param  {srting} division
 * @return {srting} orgID
 */
ConfigHelper.prototype.getOrgByAccount = function(account, division){
 // looking for second participant
  for(var org in this.accountConfig){
    if(this.accountConfig.hasOwnProperty(org)){
      if( this.accountConfig[org].acc[account] && this.accountConfig[org].acc[account].indexOf(division)>=0 ){
        return org;
        // break;
      }
    }
  }
  return null;
};

/**
 * get organisation deponent code by deponent code (1 to 1 matching)
 * @param  {srting} account
 * @param  {srting} division
 * @return {srting} depCode
 */
ConfigHelper.prototype.getDepcodeByAccount = function(account, division){
  var org = this.getOrgByAccount(account, division);
  return (this.accountConfig[org] || {}).dep;
};





ConfigHelper.convertAccountConfig = function(instructionInit, role){
  role = role || 'investor';
  var obj = JSON.parse(instructionInit);
  var accData = JSON.parse(obj.Args[1]);
  return accData.reduce(function(result, item){

    var account = item.balances.reduce(function(res, it){
      res[it.account] = res[it.account] || [];
      res[it.account].push(it.division);
      return res;
    }, {});

    // HOTFIX: remove domain
    var org = (item.organization.match(/^[\w]+/)||[])[0];

    result[org] = {
      dep  : item.deponent,
      role : role, // value is valid here only for the organisation!
      acc  : account
    };
    return result;
  }, {
    // HARDCODED nsd
    "nsd":{
      acc:{},
      role: "nsd"
    }

  });

};
