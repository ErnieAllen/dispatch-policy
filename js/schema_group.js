/*

Copyright Redhat Inc. 2017

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

// add a group entityType to the schema to simplify form validation
var add_group_schema = function (schema) {
  delete schema.entityTypes.policy.attributes.policyDir
  schema.entityTypes['group'] = {
    attributes: {
      name: {
        'default': '',
        type: 'string',
        description: 'The name for this group'
      },
      users: {
        'default': "",
        type: 'string',
        description: 'Comma separated list of authenticated users in this group.'
      },
      remoteHosts: {
        'default': "",
        type: 'string',
        description: 'List of remote hosts from which the users may connect. List values may be host names, numeric IP addresses, numeric IP address ranges, or the wildcard *. An empty list denies all access.'
      },
      maxFrameSize: {
        'default': "2^31-1",
        type: 'integer',
        description: 'Largest frame that may be sent on this connection. (AMQP Open, max-frame-size)'
      },
      maxSessions: {
        'default': 65535,
        type: 'integer',
        description: 'Maximum number of sessions that may be created on this connection. (AMQP Open, channel-max)'
      },
      maxSessionWindow: {
        'default': '2^31-1',
        type: 'integer',
        description: 'Incoming capacity for new sessions. (AMQP Begin, incoming-window)'
      },
      maxMessageSize: {
        'default': '0 (no limit)',
        type: 'integer',
        description: 'Largest message size supported by links created on this connection. If this field is zero there is no maximum size imposed by the link endpoint. (AMQP Attach, max-message-size)'
      },
      maxSenders: {
        'default': '2^31-1',
        type: 'integer',
        description: 'Maximum number of sending links that may be created on this connection.'
      },
      maxReceivers: {
        'default': '2^31-1',
        type: 'integer',
        description: 'Maximum number of receiving links that may be created on this connection.'
      },
      allowDynamicSource: {
        'default': false,
        type: 'boolean',
        description: 'This connection is allowed to create receiving links using the Dynamic Link Source feature.'
      },
      allowAnonymousSender: {
        'default': false,
        type: 'boolean',
        description: 'This connection is allowed to create sending links using the Anonymous Sender feature.'
      },
      allowUserIdProxy: {
        'default': false,
        type: 'boolean',
        description: 'This connection is allowed to send messages with a user_id property that differs from the connection’s authenticated user id.'
      },
      sources: {
        'default': '',
        type: 'string',
        description: 'List of Source addresses allowed when creating receiving links. This list may be expressed as a CSV string or as a list of strings. An empty list denies all access.'
      },
      targets: {
        'default': '',
        type: 'string',
        description: 'List of Target addresses allowed when creating sending links. This list may be expressed as a CSV string or as a list of strings. An empty list denies all access.'
      }
    }
  }
}
