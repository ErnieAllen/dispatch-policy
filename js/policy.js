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

  /**
   * @method TopologyController
   *
   * Controller that handles the QDR topology page
   */
  QDR.module.controller("QDR.PolicyController", ['$scope', 'QDRService', '$location', '$timeout',
    function($scope, QDRService, $location, $timeout) {

      var host = $location.host()
      var port = $location.port()

      var Adapter = Adapter_wrapper(host)                 // converts between the database model and the tree model
      var Policy = Policy_wrapper(QDRService, $location)  // sends requests to policy service
      var schema;   // router schema used to validate form entries and filter out UI decoration of the tree data
      var treeData; // working copy of the data needed to draw the tree

      // connect to the router using the address that served this web page. then get the router schema and policy tree
      var connectOptions = {address: host, port: port, reconnect: true, properties: {client_id: 'policy GUI'}}
      QDRService.management.connection.addConnectAction( function () {
        QDR.log.info("connected to dispatch network on " + host + ":" + port)

        // ask management to get the schema
        QDRService.management.getSchema(function () {
          // once schema is available, save it
          schema = QDRService.management.schema()
          // add group attributes to the schema
          add_group_schema(schema)
          console.log("got schema")
          // get policy from service
          Policy.get_policy(connectOptions)
            .then( function (response) {
              console.log("got initial policy tree")
              // convert policy data from service to tree needed for this page
              var treeModel = Adapter.treeFromDB(response, schema)
              treeData = treeModel.data
              $scope.topLevel = treeModel.level
              // don't show the policy part of the tree if we are only working on a vhost
              if ($scope.topLevel === 'vhost')
                $('.legend.policy').css('display', 'none')
              // draw the tree
              initTree($scope.topLevel, treeData)
            }, function (error) {
              Core.notification('error', error.msg)
            })
        })
      })
      // connect to router. this triggers the above addConnectAction handler once connected
      QDRService.management.connection.connect(connectOptions)

      $scope.formMode = 'edit'
      $scope.showForm = 'policy'

      // called when edit form is submitted
      var updatePolicy = function (oldName, d) {
        var DBModel = Adapter.DBFromTree(treeData, schema)
        DBModel.update = {oldKey: oldName, newKey: d.name, type: d.type, parentKey: (d.type !== 'policy' ? d.parent.name : null)}
        Policy.sendPolicyRequest(DBModel, "SAVE-POLICY", true)
      }

      // called when add form is submitted
      var savePolicy = function () {
        var DBModel = Adapter.DBFromTree(treeData, schema)
        Policy.sendPolicyRequest(DBModel, "SAVE-POLICY", true)
      }

      // create the tree svg diagram
      var initTree = function (level, root) {
        // association of classes with shapes
        var classesMap = {
            policy: "diamond",
            vhost: "square",
            group: "circle"
        }

        var calc_height = function () {
          return Math.max(Adapter.group_count(root) * 30 + Adapter.vhost_count(root) * 10, 360)
        }
        var desired_width = 600
        var desired_height = calc_height()
        var tmargin = {top: 20, right: 120, bottom: 20, left: 120},
          twidth = desired_width - tmargin.right - tmargin.left,
          theight = desired_height - tmargin.top - tmargin.bottom;

        var ti = 0,
          duration = 750

        var tree = d3.layout.tree()
          .size([theight, twidth]);

        var diagonal = d3.svg.diagonal()
          .projection(function(d) { return [d.y, d.x]; });

        var tsvg = d3.select("#topology").append("svg")
          .attr("width", twidth + tmargin.right + tmargin.left)
          .attr("height", theight + tmargin.top + tmargin.bottom)
          .append("g")
          .attr("transform", "translate(" + tmargin.left + "," + tmargin.top + ")");

        root.x0 = theight / 2;
        root.y0 = 0;

        var resizeTree = function () {
          desired_height = calc_height()
          theight = desired_height - tmargin.top - tmargin.bottom

          d3.select('#topology svg')
            .attr('height', theight + tmargin.top + tmargin.bottom)
          tree.size([theight, twidth])
        }

        // draw the svg using this data
        update(root);
        d3.select('g.'+level).classed('selected', true)
        $timeout( function () {
          $scope.showForm = level
          $scope.formData = root
          $scope.shadowData = angular.copy(root)
          $('.all-forms :input:visible:enabled:first').focus()
        })

        function update(source) {

          // Compute the new tree layout.
          var tnodes = tree.nodes(root).reverse(),
            tlinks = tree.links(tnodes);

          // Normalize for fixed-depth.
          tnodes.forEach(function(d) { d.y = d.depth * 180; });

          // Update the nodes…
          var tnode = tsvg.selectAll("g.node")
            .data(tnodes, function(d) { return d.id || (d.id = ++ti); });

          // Enter any new nodes at the parent's previous position.
          var nodeEnter = tnode.enter().append("g")
            .attr("class", function (d) {return "node " + d.type + (d.add ? " add" : '')})
            .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
            .on("click", click)

          // use a shape for a node depending on its class
          nodeEnter.append("path")
            .attr("d", d3.svg.symbol()
                 .size(150)
                 .type(function(d) {
                    return classesMap[d.type]
                  }))

          nodeEnter.append("text")
            .attr("x", function(d) { return d.children || d._children ? -13 : 13; })
            .attr("dy", ".35em")
            .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
            .text(function(d) { return d.add ? ("Add " + d.type) : d.name })
            .style("fill-opacity", 1e-6);

          nodeEnter.append("svg:title")
            .text(function(d) {
              if (d.add) {
                return "Click to add a " + d.type
              }
            return "Click to edit this " + d.type
            })

          // Transition nodes to their new position.
          var nodeUpdate = tnode.transition()
            .duration(duration)
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

          nodeUpdate.select("path")
            .attr("transform", "scale(1)")

          nodeUpdate.select("text")
            .style("fill-opacity", 1);

          // Transition exiting nodes to the parent's new position.
          var nodeExit = tnode.exit().transition()
            .duration(duration)
            .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
            .remove();

          nodeExit.select("path")
            .attr("transform", "scale(" + 1e-6 + ")")

          nodeExit.select("text")
            .style("fill-opacity", 1e-6);

          // Update the links…
          var tlink = tsvg.selectAll("path.link")
            .data(tlinks, function(d) { return d.target.id; });

          // Enter any new links at the parent's previous position.
          tlink.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function(d) {
            var o = {x: source.x0, y: source.y0};
            return diagonal({source: o, target: o});
            });

          // Transition links to their new position.
          tlink.transition()
            .duration(duration)
            .attr("d", diagonal);

          // Transition exiting links to the parent's new position.
          tlink.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
            var o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
            })
            .remove();

          // Stash the old positions for transition.
          tnodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
          });
        }

        $scope.formData = {}
        $scope.$watch('currentForm.$dirty', function(newVal, oldVal) {
          if (oldVal != newVal) {
            var body = $('body')
            var w = $(window)
            var allForms = $('.all-forms')
            var topology = $('#topology')
            var height = Math.max(Math.max(Math.max(allForms.height(), topology.height(), body.height()), w.height())) + 100
            var makeModalDiv = $('#gmodal')
            if (newVal) {
              makeModalDiv.addClass("ismodal")
              makeModalDiv.height(height)
            } else {
              makeModalDiv.removeClass("ismodal")
              makeModalDiv.height(0)
          }
          }
        })

        var warnPlaceholder = function (name, newVal) {
          var element = $("input[name='"+name+"']")
          if (!angular.isDefined(newVal)) {
            newVal = element.val()
          }
          if (!angular.isDefined(newVal) || (newVal.trim() === '')) {
            element.addClass("warning")
          } else {
            element.removeClass("warning")
          }
        }
        $scope.$watch('formData.sources', function (newVal, oldVal) {
          if (oldVal != newVal) {
            warnPlaceholder('sources', newVal)
          }
        })
        $scope.$watch('formData.targets', function (newVal, oldVal) {
          if (oldVal != newVal) {
            warnPlaceholder('targets', newVal)
          }
        })
        var clickon = function (d) {
          var node = d3.selectAll('.node.'+d.type).filter(function(g) {
              return d.name === g.name && (d.parent ? (d.parent.name === g.parent.name) : true)
            }).node();
          click.call(node, d)
        }
        function click(d) {
          var selected = d3.select(this).classed("selected")
          // clicked on the current node
          //if (selected)
          //  return

          $timeout( (function () {
            // remove all selected classes from all nodes
            d3.selectAll('svg .selected').each(function (ds) {
              d3.select(this).classed('selected', false)
            })
            // set selected on this node
            d3.select(this).classed("selected", true)
            showForm(d)
            $timeout(function () {
              $('.all-forms :input:visible:enabled:first').focus()
            })
          }).bind(this))
          //$scope.validateName(d.type)
          return;

          // collapse / expand the child nodes
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
            d._children = null;
          }
          update(d);
        }

        var showForm = function (d) {
          $scope.showForm = d.type
          $scope.formData = d
          $scope.formMode = d.add ? 'add' : 'edit'
          $scope.shadowData = angular.copy(d)
          // let new form load before accessing its elements
          $timeout( function () {
            warnPlaceholder('sources')
            warnPlaceholder('targets')
          })
        }

        var treeNode = function (d) {
          this.name = d.name
          this.type = d.type
          this.parent = d.parent
        }

        var setAddVhost = function (d) {
          d.name = ""
          d.type = "vhost"
          d.add = true
        }
        var setAddGroup = function (d) {
          // remove any attributes in the schema
          var attributes = schema.entityTypes['group'].attributes
          for (var dattr in d) {
            if (angular.isDefined(attributes[dattr]))
              delete d[dattr]
          }
          d.name = ""
          d.type = "group"
          d.add = true
        }

        var revert = function (target, source) {
          var entity = schema.entityTypes[source.type]
          for (var attr in entity.attributes) {
            if (angular.isDefined(target[attr]) && !angular.isDefined(source[attr]) )
              delete target[attr]
            if (angular.isDefined(source[attr]) && (attr !== 'id'))
              target[attr] = source[attr]
          }
          $scope.currentForm.$setPristine()
        }
        var trimAll = function (d) {
          var attributes = schema.entityTypes[d.type].attributes
          for (var dattr in d) {
            if (angular.isDefined(attributes[dattr]) && attributes[dattr].type === 'string' && (typeof d[dattr] == 'string'))
              d[dattr] = d[dattr].trim()
          }
        }
        // the delete button was clicked
        $scope.formDelete = function (d) {
          var req = {type: $scope.showForm}
          if ($scope.showForm === 'vhost')
            req.vhost = $scope.formData['name']
          else if ($scope.showForm === 'group') {
            req.vhost = $scope.formData.parent.name
            req.group = $scope.formData['name']
          }
          Policy.sendPolicyRequest(req, "DELETE", false)
            .then( function (response) {
              if (response != "OK") {
                Core.notification("error", "delete failed: " + response)
              } else
                Core.notification("success", $scope.showForm + " " + d.name + " deleted")
                // find this tree node in the parent's children list
                for (var i=0; i<d.parent.children.length; i++) {
                  if (d.name === d.parent.children[i].name) {
                    d.parent.children.splice(i, 1)
                    resizeTree()
                    update(d.parent)
                    $timeout( function () {
                      clickon(d.parent)
                    })
                    break;
                  }
                }
            })
        }
        // the edit form was submitted
        $scope.formEditOK = function (d, form) {
          trimAll(d)
          form.$setPristine()
          //deselectAll()
          if (d.add)
            return $scope.formAddOK(d)

          $timeout( function () {
            var oldName = $scope.shadowData.name
            revert($scope.shadowData, d)
            d3.selectAll("g." + d.type + " text").each(function(dt) {
              if (dt.name === d.name)
                d3.select(this).text(d.name);
            });
            if (oldName !== d.name) {
              updatePolicy(oldName, d)
            } else
              savePolicy()
          })
        }
        // the edit form was submitted on a new entity
        $scope.formAddOK = function (d) {
          $timeout( function () {
            // copy the form's values to a new node
            var n = new treeNode(d)
            revert(n, d)
            n.parent = d.parent.name
            // revert the add node's values
            if (d.type === 'vhost') {
              setAddVhost(d)
              var g = new treeNode(d)
              setAddGroup(g)
              g.parent = n.name
              n.children = [g]
            } else {
              setAddGroup(d)
            }
            revert($scope.shadowData, d)

            // add the new node in the 2nd to last position to preserve the Add node at the end
            d.parent.children.splice(d.parent.children.length-1, 0, n)

            // resise and redraw the tree
            resizeTree()
            update(d.parent)

            // highlight the add child of the newly added node
            if (n.children && n.children.length == 1) {
              clickon(n.children[0])
            }
            // save the data
            savePolicy()
          })
        }

        var deselectAll = function () {
          d3.selectAll('svg .selected').each(function () {
            d3.select(this).classed('selected', false)
          })
        }
        $scope.formCancel = function () {
          $timeout( function () {
            //Core.notification('warning', $scope.formMode + " " + $scope.formData.type + ' cancelled')
            // restore any changed data
            revert($scope.formData, $scope.shadowData)
          })
        }
        $scope.formValue = function (attr) {
          if ($scope.formData[attr])
            return formData.attr
          else {
            return 'Defaults to ' + schema.entityTypes[$scope.formData.type].attributes[attr]['default']
          }
        }

        $scope.defaultGroup = false
        $scope.dupUserGroup = ''
        $scope.dupUserName = ''

        $scope.$watch('formData.name', function(newVal, oldVal) {
          $scope.defaultGroup = (newVal === '$default')
        })
      }
    }
  ]);

  return QDR;
}(QDR || {}));

  // Custom form validator to prevent sibling vhosts and groups from having the same name
  // This is used by the html form on an input element like so: <input duplicate-sibling-name ... />
  QDR.module.directive('duplicateSiblingName', [function () {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, element, attr, ngModel) {

        ngModel.$validators.duplicateName = function(modelValue, viewValue) {
          var root = scope.$parent.formData.parent
          var id = scope.$parent.formData.id
          var notDuplicate = true;
          if (modelValue.trim() !== '' && root.children) {
            for (var i=0; i<root.children.length; i++) {
              // skip self
              if (root.children[i].id !== id) {
                if (root.children[i].name.toLowerCase().trim() === modelValue.toLowerCase().trim()) {
                  notDuplicate = false
                  break
                }
              }
            }
          }
          return notDuplicate;
        }
      }
    }
  }])

  // Custom form validator to prevent sibling groups from containing duplicate user names
  // <input duplicate-user .... />
  QDR.module.directive('duplicateUser', [function () {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, element, attr, ngModel) {
        var msg = function (group, user, same) {
          if (!same)
            scope.$parent.dupUserMsg = "User can be in only one group for this vhost. The user "+user+" was also found in "+group+"."
          else
            scope.$parent.dupUserMsg = "The user "+user+" appears in this list multiple times."

        }
        var cmp = function (root, users, id, i) {
          if (!angular.isDefined(root.children[i].users))
            return false
          var nusers = root.children[i].users.python_split(' ')
          var found = false
          for (var j=0; j<users.length; j++) {
            found = nusers.some ( function (nuser) {
              if (users.indexOf(nuser) >= 0) {
                msg(root.children[i].name, nuser, false)
                return true
              }
              return false
            })
            if (found) {
              break;
            }
          }
          return found
        }

        ngModel.$validators.duplicateUser = function(modelValue, viewValue) {
          var root = scope.$parent.formData.parent
          var notDuplicate = true;
          if (modelValue && modelValue.trim() !== '') {
            var id = scope.$parent.formData.id
            // make sure there are no duplicated user names in this group
            var users = modelValue.python_split(' ')
            for (var i=0; i<root.children.length; i++) {
              // skip self
              if (root.children[i].id !== id) {
                if (cmp(root, users, id, i)) {
                  notDuplicate = false
                  break
                }
              } else {
                // prevent same name appearing twice in this edit field
                notDuplicate = !users.some(function(user, idx){
                    if (users.indexOf(user, idx+1) !== -1) {
                      msg(root.children[i].name, user, true)
                      return true
                    }
                    return false
                });
              }
            }
          }
          return notDuplicate;
        }
      }
    }
  }])

  // modified from http://benjii.me/2014/07/angular-directive-for-bootstrap-switch/
  // allows ng-model tracking for jquery bootstrap-switch
  QDR.module.directive('bootstrapSwitch', [
   function() {
     return {
       restrict: 'A',
       require: '?ngModel',
       link: function(scope, element, attrs, ngModel) {
         element.bootstrapSwitch('size', 'small');

         element.on('switchChange.bootstrapSwitch', function(event, state) {
           if (ngModel) {
             scope.$apply(function() {
               ngModel.$setViewValue(state);
             });
           }
         });

         scope.$watch(attrs.ngModel, function(newValue, oldValue) {
           element.bootstrapSwitch('state', newValue || false, true);
         });
       }
     };
   }
 ]);


