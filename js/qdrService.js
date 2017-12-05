/*
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
/**
 * @module QDR
 */
var QDR = (function(QDR) {

  // The QDR service handles the connection to
  // the server in the background
  QDR.module.factory("QDRService", ['$rootScope', '$http', '$timeout', '$resource', '$location', function($rootScope, $http, $timeout, $resource, $location) {

    var dm = require("dispatch-management")
    var self = {

      policy: new dm.Management($location.protocol()),      // linkRouted connection to policy server
      management: new dm.Management($location.protocol()),  // connection to router
      utilities: dm.Utilities,

      humanify: function(s) {
        if (!s || s.length === 0)
          return s;
        var t = s.charAt(0).toUpperCase() + s.substr(1).replace(/[A-Z]/g, ' $&');
        return t.replace(".", " ");
      },
      pretty: function(v) {
        var formatComma = d3.format(",");
        if (!isNaN(parseFloat(v)) && isFinite(v))
          return formatComma(v);
        return v;
      },

      flatten: function(attributes, result) {
        var flat = {}
        attributes.forEach(function(attr, i) {
          if (result && result.length > i)
            flat[attr] = result[i]
        })
        return flat;
      }
    }
    return self;
  }]);

  return QDR;

}(QDR || {}));


