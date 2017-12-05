#!/usr/bin/env python
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

# modified from qpid-proton/examples/python/server.py

from __future__ import print_function
import argparse

from proton import Message, Url
from proton.handlers import MessagingHandler
from proton.reactor import Container

from db import DB
import pdb

class Operations(object):
    def __init__(self, verbose):
        super(Operations, self).__init__()
        self.verbose = verbose

    def do_op(self, op, request, vhost):
        m = op.replace("-", "_").upper()
        try:
            method = getattr(self, m)
        except AttributeError:
            print (op + " is not implemented yet")
            return u'not implemented'
        if self.verbose:
            print ("Got request " + op)
        return method(request, vhost)

    def SAVE_POLICY(self, request, vhost):
        with DB(verbose=self.verbose) as db:
            db.update(request, vhost)
        return u'policy saved'

    def DELETE(self, request, vhost):
        if vhost is not None:
            assert vhost == request['vhost']
        with DB(verbose=self.verbose) as db:
            if request['type'] == 'vhost':
                return db.deleteVhost(request['vhost'])
            elif request['type'] == 'group':
                return db.deleteGroup(request['group'], request['vhost'])
        return unicode('unknown type ' + request['type'])

    def GET_VHOST(self, request, vhost):
        if vhost is None:
            vhost = request['name']
        with DB(verbose=self.verbose) as db:
            return db.getVHosts(vhost)

    def GET_POLICY(self, request, vhost):
        policy = {'empty': True}
        with DB(verbose=self.verbose) as db:
            if vhost is None:
                policy = db.getPolicy()
            vhosts = db.getVhosts(vhost)
        return {'policy': policy, 'vhosts': vhosts}

class Server(MessagingHandler):
    def __init__(self, url, verbose):
        super(Server, self).__init__()
        self.url = url
        self.verbose = verbose
        self.operations = Operations(verbose)

    def on_start(self, event):
        if self.verbose:
            print("Listening on", self.url)
        event.container.listen(self.url)

    def on_link_opening(self, event):
        if event.link.remote_target.address:
            if self.verbose:
                print("opening remote link", event.link.remote_target.address)

    def on_connection_opened(self, event):
        if self.verbose:
            print ('connection opened')

    def on_message(self, event):
        if self.verbose:
            print("Received", event.message)
        targetAddress = event.link.remote_target.address

        # look for multi-tenant request in the form of /<group_name>/policy
        if self.verbose:
            print ('  target.address', targetAddress)
        parts = targetAddress.split('/')
        vhost = parts[-2]
        if vhost == '':
            vhost = None    # got request at address /policy

        op = event.message.properties['operation']
        response = self.operations.do_op(op, event.message.body, vhost)
        if self.verbose:
            print ('  sending response to', event.message.reply_to)

        sender = event.container.create_sender(event.connection)
        sender.send(Message(address=event.message.reply_to, body=response,
                                 correlation_id=event.message.correlation_id))
        sender.close()

parser = argparse.ArgumentParser(description='Serve and persist dispatch router policy settings.')
parser.add_argument("-a", "--address", default="0.0.0.0:25674", help="Addres on which to listen for policy requests (default: %(default)s)")
parser.add_argument('-v', "--verbose", action='store_true', help='verbose output')
args = parser.parse_args()

url = Url(args.address)
verbose = args.verbose
try:
    Container(Server(url, verbose)).run()
except KeyboardInterrupt: pass
