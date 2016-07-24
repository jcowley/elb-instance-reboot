const AWS = require('aws-sdk');
const waterfall = require('async-waterfall');

exports.handler = function(event, context, callback) {

  const message = JSON.parse(event.Records[0].Sns.Message);
  const elb = (message.Trigger && message.Trigger.Dimensions) ? message.Trigger.Dimensions[0] : null;

  if (!elb) return console.log('No elb value found in message', message);

  const elbApi = new AWS.ELB();
  const ec2Api = new AWS.EC2();

  waterfall([
    function(next){
      const params = {
        LoadBalancerNames: [elb.value]
      };
      elbApi.describeLoadBalancers(params, next);
    },
    function(data, next){
      const params = {
        LoadBalancerName: elb.value,
        Instances: data.LoadBalancerDescriptions[0].Instances
      };
      elbApi.describeInstanceHealth(params, next);
    },
    function(data, next){
      const unhealthyNodes = data.InstanceStates
        .filter(instance => instance.State === 'OutOfService')
        .map(instance => instance.InstanceId);
      if (unhealthyNodes.length) {
        console.log('Rebooting unhealthy nodes', unhealthyNodes);
        ec2Api.rebootInstances({InstanceIds: unhealthyNodes}, next);
      } else {
        next(null, 'All nodes InService, no reboots necessary');
      }
    }
  ], function (err, result) {
      console.log('Process complete', result);
      callback(err, (err) ? 'Fail' : 'Success');
  });
};