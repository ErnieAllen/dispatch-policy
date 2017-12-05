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

// Wrap all policy request logic
var Policy_wrapper = function (QDRService, $location) {
    var policy = {}           // public. any properties put on this variable will be exposed
    var address = '/policy'   // private

    // connect to the policy server and request the policy for the current address (vhost or root policy)
    policy.get_policy = function (connectOptions) {
      var p = new Promise( function (resolve, reject) {
        QDRService.policy.connection.addConnectAction( function () {
          policy.sendPolicyRequest([], 'GET-POLICY', false)
            .then( function (response) {
              resolve(response)
            }, function (error) {
              reject(error)
            })
        })
        connectOptions.properties = {client_id: 'policy linkRoute'}
        connectOptions.sender_address = address
        connectOptions.hostname = $location.host()  // allow multi-tenancy
        QDRService.policy.connection.connect(connectOptions)
      })
      return p
    }

    // send a policy request and Handle notification message if requested
    policy.sendPolicyRequest = function (req, operation, notify) {
      var p = new Promise( function (resolve, reject) {
        QDRService.policy.connection.send(req, address, operation)
          .then( function (success) {
            if (notify)
              Core.notification("success", success.response)
            resolve(success.response)
          }, function (error) {
            if (notify)
              Core.notification("error", error.response)
            reject(Error(error.response))
          })
      })
      return p
    }

    return policy;
}
