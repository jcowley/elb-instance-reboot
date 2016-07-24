# elb-instance-reboot

An AWS lambda function that reboots ELB instances that are out of service. 
The function can be automatically triggered by a CloudWatch alarm via 
an SNS topic message.

## Prerequisites

* AWS account with access to: IAM, Lambda, SNS, CloudWatch, ELB, and EC2

The following installed on your local machine (for deployment):

* [Node (with NPM) Installed](https://docs.npmjs.com/getting-started/installing-node) 
* [Claudia NPM package](https://www.npmjs.com/package/claudia) `npm install -g claudia`
* [AWS CLI Installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) 
* [AWS CLI credentials configured](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) Just run `aws configure`

## Deployment and Configuration

To deploy and configure the lambda function, run the following commands from the top-level project directory.

### Step 1: Deploy the lambda function

Substitute the region of your elb for {region}, e.g. `us-west-2`

(*Note*: AWS calls often take a few seconds to return. So we need to 
bump the lambda function timeout to 60 seconds.)

```
claudia create --handler elb-instance-reboot.handler --policies policies --timeout 60 --region {region}
```

### Step 2: Create an SNS Topic

```
aws sns create-topic --name elb-unhealthy-instances
```

### Step 3: Subscribe the lambda function to the SNS Topic

Use the `TopicArn` value returned from the last step for {topic}. It 
will be in the form `arn:aws:sns:{region}:{owner id}:elb-unhealthy-instances`

```
claudia add-sns-event-source --topic {topic}
```

### Step 4: Configure a CloudWatch alarm

The following command will create a CloudWatch alarm that is triggered when
one or more EC2 instances are out of service for more than 1 minute. You can 
alter the values for threshold, period, and evaluation-periods to suit your needs.

Substitute the name of the load balancer you want to monitor for {elb name}. 
Substitute the `TopicArn` value from step 3 for {topic}.

```
aws cloudwatch put-metric-alarm --alarm-name unhealthy-instances \
 --metric-name UnHealthyHostCount \
 --namespace AWS/ELB \
 --statistic Minimum \
 --period 60 \
 --threshold 1 \
 --comparison-operator GreaterThanOrEqualToThreshold \
 --evaluation-periods 1 \
 --alarm-actions {topic} \
 --dimensions "Name=LoadBalancerName,Value={elb name}" 
```

If you have multiple load balancers that you want to monitor, set a separate alarm
for each one. These alarms can all point to the same SNS Topic and utilize the same
lambda function.

## Test

You can confirm that the service is working by manually taking one of your EC2 instances out of service, e.g.
by logging in and killing the service that responds to the healthcheck endpoint.

## Monitoring 

You can subscribe to the SNS topic via email to be notified when the alarm is triggered.

To see the results of any executions of the lambda function, look at the /aws/lambda/elb-instance-reboot log group
under Cloudwatch Logs.


