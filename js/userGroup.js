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

var QDR = (function(QDR) {

  QDR.module.controller('QDR.addGroupCtrl', function ($scope, $rootScope, $timeout) {
      var vhost = $scope.formData
      $scope.data = {
        addAGroup: '',
      };
      $scope.addGroup = function () {
        $timeout( function () {
          var d = {name: $scope.data.addAGroup, users: '', type: 'group', parent: vhost}

          // add the new node in the 2nd to last position to preserve the Add node at the end
          d.parent.children.splice(d.parent.children.length-1, 0, d)

          // save the data
          $scope.savePolicy(true)
            .then( function () {
              // resise and redraw the tree
              $scope.resizeTree()
              $scope.update(d.parent)
              // update any grids
              $rootScope.$broadcast('groupAdded', angular.copy($scope.data.addAGroup))
              // clear the group name
              $scope.data.addAGroup = ''
            })
        })
      }

  })

  QDR.module.controller('QDR.sourceCtrl', function ($scope, $timeout, $uibModal, uiGridConstants) {
    // multi-select dropdown list
    $scope.groupModel = []
    $scope.groupData = []
    $scope.groupSettings = {
      showCheckAll: false,
      showUncheckAll: false,
      smartButtonMaxItems: 2,
    }
    // source edit box
    $scope.data = {
      addAddress: '',
      toSource: true,
      toTarget: true
    }
    // source/groups grid
    $scope.sourceGridData = []
    $scope.sourceGrid = {
      data: $scope.sourceGridData,
      enableColumnMenus: false,
      enablePagination: true,
      paginationPageSize: 10,
      columnDefs: []
    }

    var addAddressToGroup = function (group, address, which) {
      var addresses = $scope.getCSVList(group, which)
      if (addresses.length === 1 && addresses[0] == '')
        addresses = []
      addresses.push(address)
      group[which] = addresses.join(', ')
    }

    var removeAddressFromGroup = function (group, address, which) {
      var addresses = $scope.getCSVList(group, which)
      if (addresses.length === 1 && addresses[0] == '')
        return
      var idx = addresses.indexOf(address)
      if (idx >= 0) {
        addresses.splice(idx, 1)
        group[which] = addresses.join(', ')
      }
    }

    $scope.addAddress = function () {
      var address = $scope.data.addAddress
      var groupNames = $scope.groupModel.map( function (gm) { return gm.label})
      // for each selected group, add this source
      groupNames.forEach( function (groupName) {
        group = $scope.findGroup($scope.formData, groupName)
        if ($scope.data.toSource)
          addAddressToGroup(group, address, 'sources')
        if ($scope.data.toTarget)
          addAddressToGroup(group, address, 'targets')
      })
      $scope.savePolicy(false)
        .then( function () {
          $timeout( function () {
            Core.notification('success', 'Address added')
            formChanged()
          })
        })
    }

    var addressColumn = {
      name:         'address',
      defaultSort:  { direction: uiGridConstants.ASC, priority: 0},
      width:        '20%'
    }
    var generateColumns = function (groups) {
      var width = Math.max(80 / groups.length, 10) + "%"
      $scope.sourceGrid.columnDefs = [addressColumn]
      groups.forEach( function (group) {
        $scope.sourceGrid.columnDefs.push({name: group.name, width: width, cellTemplate: "srcTrgTmpl.html"})
      })
    }
    var groupFieldContains = function (group, fieldName, field) {
      var list = $scope.getCSVList(group, field)
      return list.indexOf(fieldName) > -1
    }
    var generateMatrix = function (sources, targets, groups) {
      var addresses = sources.concat(targets.filter(function (t) {return sources.indexOf(t) < 0}))
      $scope.sourceGrid.data = []
      addresses.forEach( function (address) {
        var row = {address: address}
        groups.forEach( function (group) {
          row[group.name] = groupFieldContains(group, address, 'sources') ? 's' : ''
          row[group.name] += (groupFieldContains(group, address, 'targets') ? 't' : '')
        })
        $scope.sourceGrid.data.push(row)
      })
    }
    // return list of unique addresses found in all groups
    var getFieldList = function (groups, field) {
      var list = []
      groups.forEach( function (group) {
        var f = $scope.getCSVList(group, field)
        list.push.apply(list, f.filter ( function (s) {return list.indexOf(s) < 0}))
      })
      return list
    }
    var getGroupList = function () {
      return $scope.formData.children.filter( function (group) { return group.name && !group.add} )
    }
    var generateGroupData = function (groups) {
      $scope.groupData = []
      groups.forEach( function (group, i) {
        $scope.groupData.push({id: i, label: group.name})
      })
    }
    var updateGroupModel = function () {
      var curGroupNames = $scope.groupModel.map( function (gm) { return gm.label})
      $scope.groupModel = []
      $scope.groupData.forEach( function (data) {
        if (curGroupNames.indexOf(data.label) >= 0)
          $scope.groupModel.push(data)
      })
    }
    var formChanged = function () {
      var groups = getGroupList()
      generateGroupData(groups)
      updateGroupModel()
      generateColumns(groups)
      var sources = getFieldList(groups, 'sources')
      var targets = getFieldList(groups, 'targets')
      generateMatrix(sources, targets, groups)
      $scope.resizeGrid('sourceGrid', $scope.sourceGrid.data)
    }
    $timeout( function () {
      formChanged()
    })
    $scope.anyAddresses = function () {
      var groups = getGroupList()
      return getFieldList(groups, 'sources').length > 0 || getFieldList(groups, 'targets').length > 0
    }
    $scope.$on('groupAdded', function(event, groupName) {
      $timeout( function () {
        formChanged()
      })
    });
    $scope.onOff = function (row, col, which) {
      var parts = ['Remove', row.entity.address,'from']
      if (row.entity[col.field].indexOf(which) === -1) {
        parts[0] = 'Add '
        parts[2] = 'to'
      }
      parts.push(col.field)
      parts.push(which === 's' ? 'source' : 'target')
      return parts.join(' ')
    }
    $scope.getClass = function (row, col, which) {
      return row.entity[col.field].indexOf(which) >= 0 ? 'btn-primary' : ''
    }
    $scope.toggle = function (row, col, w) {
      var which = (w === 's' ? 'sources' : 'targets')
      var groupName = col.field
      var group = $scope.findGroup($scope.formData, groupName)
      var address = row.entity.address

      var parts = [address, 'added to', groupName, which]
      if (row.entity[col.field].indexOf(w) === -1) {
        addAddressToGroup(group, address, which)
      } else {
        parts[1] = 'removed from'
        removeAddressFromGroup(group, address, which)
      }

      $scope.savePolicy(false)
        .then( function () {
          $timeout( function () {
            Core.notification('success', parts.join(' '))
            formChanged()
          })
        })
    }
  })

  QDR.module.controller('QDR.addUserGroupCtrl', function ($scope, $timeout, $uibModal, uiGridConstants) {
      var vhost = $scope.formData
      //$scope.formData = {id: vhost.id, parent: vhost}
      $scope.data = {
        addUser: '',
        addAGroup: '',
        availableOptions: []
      };
      $scope.chosenOption = {}
      $scope.userGridData = []
      $scope.userGrid = {
        data: $scope.userGridData,
        enableFiltering: true,
        enableColumnMenus: false,
        enablePagination: true,
        paginationPageSize: 10,
        columnDefs: [
          {name: 'user',
            cellTemplate: "userTemplate.html",
            filter: {placeholder: 'Filter user'},
            defaultSort: {
                direction: uiGridConstants.ASC,
                priority: 0
               }
            },
          {name: 'group', cellTemplate: "groupTemplate.html", filter: {placeholder: 'Filter group'}}
        ]
      }
      $scope.status = {isUserOpen: true}
      $scope.changingGroup = false

      $scope.$on('groupAdded', function(event, groupName) {
        formChanged()
        // set the add group dropdown to the new group
        $scope.data.selectedOption = $scope.data.availableOptions.filter( function (opt) { return opt.name === groupName})[0]
      });

      // construct the user/group grid shown on the vhost form
      var formChanged = function () {
        $scope.userGridData = []
        $scope.data.availableOptions = []
        // get list of users/groups
        for (var i=0; i<vhost.children.length; i++) {
          var group = vhost.children[i]
          if (!group.add) {
            var aoption = {id: i, name: group.name}
            $scope.data.availableOptions.push(aoption)
            var users = $scope.getCSVList(group, 'users')
            for (var u=0; u<users.length; u++) {
              $scope.userGridData.push({user: users[u], group: group.name})
              $scope.chosenOption[users[u]] = aoption
            }
          }
        }
        $scope.userGrid.data = $scope.userGridData
        $scope.data.selectedOption = $scope.data.availableOptions.length > 0 ? $scope.data.availableOptions[0] : {}
        $scope.resizeGrid('groupUsers', $scope.userGridData, true)
        addErrorClass()
      }
      $timeout( function () {
        formChanged()
      })

      // add the error class to any groups that don't have users
      // called each time a changes occurs
      var addErrorClass = function () {
        d3.selectAll('g.node.group')
          .each( function (d) {
            d3.select(this)
              .classed("error", function (n) {
                return (n.add || (n.users && $scope.getCSVList(n, 'users').length) || n.name === '$default') ? false : true
              })
          })
      }


      var promptToRemoveGroup = function (group) {
        return new Promise( function (resolve, reject) {
          var d = $uibModal.open({
            backdrop: true,
            keyboard: true,
            backdropClick: true,
            templateUrl: "deleteGroup.html",
            controller: "QDR.deleteGroup",
            resolve: { groupName: function() {return group} }
          });
          d.result.then(function(result) {
            if (result.yes)
              resolve(true)
            else
              reject(Error())
          }, function (error) {
            console.log(error)
          })
        })
      }

      // add new user
      $scope.addUserToGroup = function () {
        if (!$scope.data.addUser || $scope.data.addUser === '')
          return
        var d = vhost
        var group = $scope.findGroup(vhost, $scope.data.selectedOption.name)
        addUser($scope.data.addUser, group)
        $scope.savePolicy(false)
          .then( function () {
            $timeout( function () {
              formChanged()
              $scope.data.selectedOption = $scope.data.availableOptions.filter( function (opt) { return opt.name === group.name})[0]
              Core.notification("success", $scope.data.addUser + ' added to ' + $scope.data.selectedOption.name)
              $scope.data.addUser = ''
            })
          })
      }

      $scope.doChangeGroup = function (row) {
        var user = row.entity.user
        var groupName = row.entity.group
        var newGroup = $scope.chosenOption[user].name
        if (newGroup !== groupName) {
          // remove the user from the old group
          var group = $scope.findGroup(vhost, groupName)
          var empty = removeUser(user, group)
          console.log(user + ' removed from group ' + groupName + ' empty:'+ empty)

          // add the user to the new group
          var nGroup = $scope.findGroup(vhost, newGroup)
          addUser(user, nGroup)
          // save the changes to the database
          $scope.savePolicy(false)
            .then( function () {
              $timeout( function () {
                // change the grid data to reflect the new group name
                formChanged()
                Core.notification("success", user + " moved to " + newGroup)
                // if the old group's user list is empty
                if (empty) {
                  promptToRemoveGroup(groupName)
                    .then( function (yes) {
                      // submit the request to delete the now empty group
                      $scope.formDelete(group, 'group')
                    }, function (no) {
                      var i=0
                    })
                }
              })
            })

        } else {
          console.log("!!!newGroup (" + newGroup + ") was the same as groupName (" + groupName + ")")
        }
      }

      var removeUser = function (user, group) {
        var users = $scope.getCSVList(group, 'users')
        var idx = users.indexOf(user)
        users.splice(idx, 1)
        if (users.length > 0)
          group.users = users.join(', ')
        else
          group.users = ''
        return group.users === ''
      }
      var addUser = function (user, group) {
        var users = $scope.getCSVList(group, 'users')
        if (users.length === 1 && users[0] == '')
          users = []
        users.push(user)
        group.users = users.join(', ')
      }

      $scope.deleteUser = function (row) {
        $timeout( function () {
          var user = row.entity.user
          var groupName = row.entity.group
          var group = $scope.findGroup(vhost, groupName)
          var empty = removeUser(user, group)
          formChanged()
          $scope.savePolicy(false)
          Core.notification("success", user + ' deleted from ' + groupName)
          if (empty) {
            promptToRemoveGroup(groupName)
              .then( function (yes) {
                $scope.formDelete(group, 'group')
              }, function (no) {})
          }
        })
      }

  })

  QDR.module.controller('QDR.deleteGroup', function ($scope, $uibModalInstance, groupName) {
    $scope.group = groupName
    $scope.submit = function () {
      $uibModalInstance.close({
        yes: true,
      });
    }
    $scope.cancel = function () {
      $uibModalInstance.close({
        no: true,
      });
    }
  })

  return QDR;
}(QDR || {}));
