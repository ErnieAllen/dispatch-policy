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

/*
  The database data model looks like
  {
      policy = {
        <global policy settings>
      },

      vhosts = [
        {
          id: <vhost-name>,
          <vhost settings>,
          groups: {
              <group-name>: {
                  <user group settings>
              }
          }
        }, ....
      ]
  }

  The tree data model looks like
  {
    type: 'policy',
    <global policy settings>,
    children: [
      {
        type: 'vhost',
        name: <vhost-name>,
        <vhost settings>
        children: [
          {
            type: 'group',
            name: <group-name>,
            <user group settings>
          }...]
      }, ...
    ]
  }
*/

// convert between the database model and the tree model
var Adapter_wrapper = function (host) {
  var adapter = {}
  var host = host

  var Group = function (d, name, parent) {
    c = angular.copy(d)
    c.name = name
    c.parent = parent
    c.type = 'group'
    return c
  }

  var VHost = function (d, schema) {
    this.name = d.id
    this.parent = 'Policy'
    this.type = 'vhost'
    for (var attr in d) {
      if (schema.entityTypes.vhost.attributes[attr] && attr !== 'id') {
        if (attr === 'groups') {
          this.children = []
          for (var group in d['groups']) {
            this.children.push(new Group(d[attr][group], group, this.name))
          }
          this.children.push(new Group({add: true}, '', this.name))
        } else
          this[attr] = d[attr]
      }
    }
  }

  var policyCopy = function (d, schema) {
    var c = {}
    for (var attr in d) {
      if (schema.entityTypes.policy.attributes[attr] && attr !== 'name')
        c[attr] = d[attr]
    }
    return c
  }
  var vhostCopy = function (d, schema) {
    var c = {groups: {}}
    for (var attr in d) {
      if (attr === 'children') {
        for (var i=0; i<d.children.length; i++) {
          if (!d.children[i].add) {
            var group = groupCopy(d.children[i], schema)
            var groupName = Object.keys(group)[0]
            c.groups[groupName] = group[groupName]
          }
        }
      } else if (schema.entityTypes.vhost.attributes[attr]) {
        if (attr !== 'id') {
          if (attr === 'name')
            c['id'] = d[attr]
          else
            c[attr] = d[attr]
        }
      }
    }
    return c
  }
  var groupCopy = function (d, schema) {
    var groupName = d.name
    var c = {}
    c[groupName] = {}
    for (var attr in d) {
      if (attr !== 'name') {
        if (schema.entityTypes.group.attributes[attr]) {
          c[groupName][attr] = d[attr]
        }
      }
    }
    return c
  }

  adapter.treeFromDB = function (dbModel, schema) {
    var policy = dbModel['policy']
    var vhosts = dbModel['vhosts']
    var treeModel = {data: [], level: 'policy'}

    // no policy, use 1st (and only) vhost as tree root
    if (policy.empty) {
      treeModel.level = 'vhost'
      if (vhosts.length == 0) {
        vhosts = [{id: host, groups: {}}]
      }
      treeModel.data = new VHost(vhosts[0], schema)
    } else {
      policy.name = 'Policy'
      policy.type = 'policy'
      policy.children = []

      for (var i=0; i<vhosts.length; i++) {
        policy.children.push(new VHost(vhosts[i], schema))
      }
      var addVhost = new VHost({id: ''}, schema)
      addVhost.add = true
      policy.children.push(addVhost)

      treeModel.data = policy
    }
    return treeModel
  }
  adapter.DBFromTree = function (treeModel, schema) {
    var DBModel = {vhosts: []}
    if (treeModel.type === 'vhost') {
      DBModel.vhosts.push(vhostCopy(treeModel, schema))
    } else {
      DBModel.policy = policyCopy(treeModel, schema)
      for (var i=0; i<treeModel.children.length; ++i) {
        if (!treeModel.children[i].add)
          DBModel.vhosts.push(vhostCopy(treeModel.children[i], schema))
      }
    }
    return DBModel
  }
  adapter.group_count = function (treeModel) {
    if (['policy', 'vhost'].indexOf(treeModel.type) < 0)
      return 1

    var recurse_count = function (node, count) {
      if (node.type === 'vhost') {
        return node.children ? node.children.length : 0
      } else {
        for (var i=0; i<node.children.length; i++) {
          count += recurse_count(node.children[i], count)
        }
      }
      return count
    }
    return recurse_count(treeModel, 0)
  }
  adapter.vhost_count = function (treeModel) {
    if (treeModel.type === 'vhost')
      return 1
    else if (treeModel.type === 'policy') {
      return treeModel.children ? treeModel.children.length : 1
    }
    return 1
  }

  return adapter
}
