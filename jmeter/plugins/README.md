# JMeter AMQP Plugin

To run the AMQP Publisher/Consumer samplers in `test-plan.jmx`, install the AMQP plugin:

## Installation

### Option A: JMeter Plugins Manager (recommended)
1. Download JMeter Plugins Manager: https://jmeter-plugins.org/get/
2. Place `jmeter-plugins-manager-*.jar` into `$JMETER_HOME/lib/ext/`
3. Start JMeter GUI → Options → Plugins Manager
4. Search for "AMQP" → install `JMeter AMQP Plugin`

### Option B: Manual
1. Download: https://github.com/jlavallee/JMeter-Rabbit-AMQP/releases
   Or Maven: `com.zeroclue:jmeter-amqp-plugin:2.0`
2. Also download the RabbitMQ Java client: `com.rabbitmq:amqp-client:5.x`
3. Place both jars into `$JMETER_HOME/lib/ext/`
4. Restart JMeter

## Verified Versions
- JMeter: 5.6.3
- jmeter-amqp-plugin: 2.0
- amqp-client: 5.20.0

## Plugin Sampler Class Names
- Publisher: `com.zeroclue.jmeter.protocol.amqp.AMQPPublisher`
- Consumer:  `com.zeroclue.jmeter.protocol.amqp.AMQPConsumer`

## Note on test-plan.jmx
The `.jmx` file currently uses `GenericSampler` as a placeholder for the AMQP samplers,
with XML comments showing the full AMQP plugin configuration. Once the plugin is installed,
open the plan in JMeter GUI and replace the GenericSamplers with the actual AMQP samplers.

The HTTP Backend thread group (Thread Group 3) works without any plugin — it tests via
the REST backend and is a valid standalone test.
