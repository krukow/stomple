/*!
* @license
* @preserve,
* The MIT License
* --
* Copyright (c) <2010> Karl Krukow <karl.krukow@gmail.com>
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
* --
*
* @package Stomple
* @author Karl Krukow <karl.krukow@gmail.com>
* @copyright 2010 Karl Krukow <kkr@trifork.com>
* @license http://opensource.org/licenses/mit-license.php MIT License
* @link http://github.com/krukow/stomple
* @version 0.95 (RC1)
*/
(function() {
    var globalObject = this,
        /** David Mark's isHostMethod function,
         * see also:
         * http://peter.michaux.ca/articles/feature-detection-state-of-the-art-browser-scripting
         * Modified to use strict equality
         */
        isHostMethod = function(object, property) {
		  var t = typeof object[property];  
		  return t==='function' ||
		         (!!(t==='object' && object[property])) ||
		         t==='unknown';
		},
        Stomple,//publicly exported API or 'false' if unsupported.
        emptyFn = function() {},
        consoleAvailable = isHostMethod(globalObject,"console"),
        logAvailable = consoleAvailable && isHostMethod(globalObject.console,"log"),
        warnAvailable = consoleAvailable && isHostMethod(globalObject.console,"warn"),
        infoAvailable = consoleAvailable && isHostMethod(globalObject.console,"info"),
        trim;
    if (!isHostMethod(globalObject,"WebSocket")) {
        if (warnAvailable) {
            globalObject.console.warn(globalObject.Stomple?"Stomple already defined.":"Stomple: WebSockets not available");
        }
        globalObject.Stomple = globalObject.Stomple || false;
        return;
    }
    
    if (String.prototype.trim) {
        trim = function(str) {return str.trim();};
    } else {//http://blog.stevenlevithan.com/archives/faster-trim-javascript
        trim = function(str) {
	        str = str.replace(/^\s\s*/, '');
		    var ws = /\s/,
		        i = str.length;
		    while (ws.test(str.charAt(--i))) {}
		    return str.slice(0, i + 1);
        };
    }
    
    if (!Object.create) {
        /**
         * Modified version of Crockford/Cornford/Lasse Reichstein Nielsen's
         * object function. Modified to match EcmaScript 5th edtion Object.create
         * (no support for setting other properties than value, though).
         * 
         * @see http://www.ecma-international.org/publications/standards/Ecma-262.htm
         * @see http://groups.google.com/group/comp.lang.javascript/msg/e04726a66face2a2
         * @param {Object} o origin (to be used as prototype)
         * @param {Object} props a configuration object describing overrides as in
         *            EcmaScript 5th edition Object.create. Only supports
         *            configuration objects that have a single property named 'value',
         *            e.g. {value: 42}.
         * @return {Object} object with <code>o</code> as its prototype
         */
        Object.create = (function() {
            function F() {}
            return function(o, props) {
                F.prototype = o;
                var res = new F(), 
                    p;
                if (props) {
                    for (p in props) {
                        if (props.hasOwnProperty(p)) {
                            res[p] = props[p].value;
                        }
                    }
                }
                return res;
            };
        })();
    }
    
    /**
     * Copies all properties from the src param to the tgt param.
     * If asDataDescriptor is true, the properties of src are converted
     * to "data descriptors" i.e. a property {p: 42} becomes {p: {value: 42}},
     * for compatability with Object.create.
     * @see http://www.ecma-international.org/publications/standards/Ecma-262.htm
     * @param {Object} tgt target object
     * @param {Object} src source object
     * @param {boolean} asDataDescriptor if true, copies sources properties into target properties
     * as data descriptors.
     * @return {Object} the tgt parameter.
     */
    var copyTo = function(tgt, src, asDataDescriptor) {
        var p;
        if (asDataDescriptor) {
            for (p in src) {
                if (src.hasOwnProperty(p)) {
                    tgt[p] = {value: src[p]};
                }
            }
        } else {
            for (p in src) {
                if (src.hasOwnProperty(p)) {
                    tgt[p] = src[p];
                }
            }
        }
        return tgt;
    };
    
    
    /**
     * Computes the number of bytes in the UTF-8 encoding of its 
     * string parameter, body.
     * This is needed to set the content-length header in Stomp.
     * @param {String} body the string to compute on
     * @return {Number} Number of bytes in the UTF-8 encoding of body.
     */
    var computeContentLength = function(body) {
        if (!body) {return 0;}
        var enc = encodeURIComponent(body),
            re = /%/g,
            count = enc.length;
        while (re.exec(enc)) { count -= 2; }
        return count;
    };
    
    /**
     * "Opposite" operation of computeContentLength.
     * Given a string an a number of bytes to read. Compute the
     * index into the string to read to (to "simulate" reading that number of bytes).  
     * This is needed when receiving a Stomp message with the content-length header set.
     * @param {String} body the string to compute on
     * @param {Number} len the received content-length
     * @return {Number} index into body to read to (not including).
     */
    var computeStringLength = function(body, len) {
        if (!body || len <= 0) {
            return 0;
        }
        var i=0,
            count=0,
            c;
        while (count < len) {
            c = body.charCodeAt(i);
            if (c < 128) {
                count += 1;
            } else {
                c = encodeURIComponent(c.charAt(i));
                count += c.length/3;
            }
            i += 1;
        }
        if (count === len) {
            return i;
        } else {//should only happen with bad body, len combination 
            return i-1;//skip last partial char.
        }
        
    };
    
    
    var NULL = '\u0000',
        NL = '\n';
        
    /**
     * Prototype of frame objects. Defines a toString method to convert the frame
     * into a Stomp message.
     * 
     * The frame starts with a command (e.g., CONNECT), followed by a newline, 
     * followed by headers in a <key>:<value> with each header followed by a newline. 
     * A blank line indicates the end of the headers and beginning of the body
     * and the null indicates the end of the frame.
     */
    var FramePrototype = {
        command: null,
        headers: null,
        body: null,
        toString: function() {//http://www.sitepen.com/blog/2008/05/09/string-performance-an-analysis/
            var res = this.command,
                h,
                hds = this.headers;
            res += NL;
	        if (hds) {
	          for (h in hds) {
	            if(hds.hasOwnProperty(h)) {
                    res += h;
                    res += ':';
                    res += hds[h];
                    res += NL;
	            }
	          }
	        }
	        res += NL;
	        if (this.body) {
	          res += this.body;
	        }
            res += NULL;
	        return res;
        }
    };
    
    /**
     * Create a Stomp frame (@see Stomple.FramePrototype).
     * @param {Object} spec contains: the Stomp command, a configuration object
     * specifying headers, and a string body property.
     * @return {Object} a Stomp frame corresponding to spec. 
     */
    var make_frame = function(spec) {
        var o = {};
        if (spec.command) {
            o.command = {value: spec.command};
        }
        if (spec.headers) {
            o.headers = {value: spec.headers};
        }
        if (spec.body) {
            o.body = {value: spec.body};
        }
        var f =  Object.create(FramePrototype, o);
        return f;
    };
    
    /**
     * Prototype of Stomple client objects. 
     * Defines all the default values, and possible callbacks.
     * Properties can be changed by accessing Stomple.ClientPrototype.
     * 
     * Properties are documented inline.
     */
    var ClientPrototype = {
        
        /**
         * The timeout value in ms to use for all interaction with server.
         * If timeout occurs then a corresponding failure function is called
         * with reason timeout.
         */
        timeout: 8000,        
        /**
         * true if Stomple should automatically issue a CONNECT Stomp Frame
         * upon first action. This frees the user from explicitly calling the
         * connect function with a success and failure callback.
         */
        autoConnect: true,
        
        /**
         * true to have Stomple automatically set a 'content-length' 
         * Stomp header. Stomple computes this by computing the number of
         * bytes in the UTF-8 encoding of the frame's body.
         */
        autoContentLength: true,

        /**
         * true to have Stomple automatically set an auto-generated
         * 'receipt' header on all Stomp frames. This causes the Stomp server to send a 
         * receipt message to confirm successful receiption of the original 
         * message. The callers success function is only called upon reception of
         * the confirming message. Otherwise failure is called.
         */
        autoReceipt: true,
        
        /**
         * If a websocket error occurs close the websocket.
         */
        closeOnError: true,
        
        /**
         * If user calls the close method, send a DISCONNECT Stomp frame
         * to gracefully close connection.
         */
        disconnectOnClose: true,
        
        /**
         * Callback for the successful Stomp connect event.
         */
        onConnect: emptyFn,
        /**
         * Callback for the un-successful Stomp connect event.
         */
        connectFailed: emptyFn,
        /**
         * Handler for receiption of server ERROR frames.
         */
        onError: emptyFn,
        
        /**
         * Handler for server RECEIPT frames.
         */
        onReceipt: emptyFn,
      
        /**
         * Low-level callback: called when WebSocket opens.
         */
		socketOpen: emptyFn,
        /**
         * Low-level callback: called when WebSocket receives a message.
         */
        socketMessage: emptyFn,
        /**
         * Low-level callback: called when WebSocket closes.
         */
        socketClose: emptyFn,
        /**
         * Low-level callback: called when WebSocket has an error.
         */
		socketError: emptyFn,
        
        /**
         * true if client is connected (i.e. has a session with a Stomp server).
         */
        connected: false,
        /**
         * The underlying raw WebSocket used by this client
         */
        websocket: null,
        /**
         * A session identifier generated by server when connecting in Stomp
         */
        session: null,
        /**
         * Private. An object used when needing callbacks on autoConnect.
         */
        connectConfig: null,
        
        /**
         * Private. Id of setTimeout for connection.
         */
        connectTimeoutId: null,
        /**
         * Private. Counter used to generate message ids (the current message number).
         */
        msgid: null,
        /**
         * Private. Counter used to generate transaction ids (the current transaction number).
         */
        transid: null,
        /**
         * Private. Array of pending callback specs (corresponding to messages
         * that haven't gotten receipts yet). Each spec will either have its success
         * or failure callback called depending on what the server does. (Failure is called on timeout).
         */
        pending: null,
        /**
         * Private. Object of callback specs for the various destinations that
         * are subscribed to. For example subscribers = 
         * {
         *  'jms.topic.chat' : [{
         *          handler: function(msg) {...},
         *          thisObj: anObject
         *  }, ... ]
         *  'jms.topic.another': [...]
         * }
         */
        subscribers: null,
        /**
         * Private. A stack of active transactions. Each transaction is an object
         * {id: tid, msgs:[]}, where id identified transaction and msgs un-used right now :)
         */
        transactions: null,
        /**
         * End-point of the websocket
         */
        url: null,
        
        /**
         * Default destination.
         */
        destination: null,
        /**
         * Login for default destination.
         */
        login: null,
        /**
         * Passcode for default destination.
         */
        passcode: null,
        
        
        /**
         * Sends a CONNECT Stomp frame to initiate a Stomp session.
         * @param {Object} spec a configuration object. With optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         ack: 'client',
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        connect: function(spec) {
            if (this.connected) {
                throw new Error("Called connect when in connected state.");
            }
            this.connectConfig = spec;
            this.doConnect(spec);
        },
        
        /**
         * Sends a SEND Stomp frame to send a Stomp message to a destination.
         * @param {Object} spec a configuration object. 
         * If no default destination is active, a destination property must be specified.
         * A string property 'body' must be specified.
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        send: function(spec) {
            this.checkConnectAndDo(this.doSend, spec);
        },
        /**
         * Sends a SUBSCRIBE Stomp frame to subscribe to a Stomp destination.
         * @param {Object} spec a configuration object. 
         * If no default destination is active, a destination property must be specified.
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        subscribe: function(spec) {
            this.checkConnectAndDo(this.doSubscribe,spec);
        },
        /**
         * Sends an UNSUBSCRIBE Stomp frame to un-subscribe from a Stomp destination.
         * @param {Object} spec a configuration object. 
         * If no default destination is active, a destination property must be specified.
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        unsubscribe: function(spec) {
            this.checkConnectAndDo(this.doUnsubscribe, spec);
        },
        /**
         * Sends a BEGIN Stomp frame to start a transaction.
         * @param {Object} spec a configuration object. 
         * A transaction header is generate automatically if one is not specified (as in the 
         * example below). Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        begin: function(spec) {
            this.checkConnectAndDo(this.doBegin, spec);
        },
        /**
         * Sends a COMMIT Stomp frame to commit a transaction.
         * @param {Object} spec a configuration object. 
         * A transaction header is generate automatically (equal to that of the current BEGIN
         * frame - working in a stack-like manner) if one is not specified (as in the 
         * example below). Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        commit: function(spec) {
            this.checkConnectAndDo(this.doCommit, spec);
        },
        /**
         * Sends an ACK Stomp frame to explicitly ackowledge receiption of a message
         * to the server. (In conjunction with header: client: ack -see Stomp 
         * prototcol specification).
         * @param {Object} spec a configuration object. 
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        ack: function(spec) {
            this.checkConnectAndDo(this.doAck, spec);
        },
        /**
         * Sends an ABORT Stomp frame to abort a transaction.
         * @param {Object} spec a configuration object. 
         * A transaction header is generate automatically (equal to that of the current BEGIN
         * frame - working in a stack-like manner) if one is not specified (as in the 
         * example below). In case of nested transactions, only the inner-most transaction
         * is ABORTED (unless transaction header is specified).
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        abort: function(spec) {
            this.checkConnectAndDo(this.doAbort, spec);
        },
        /**
         * Sends a DISCONNECT Stomp frame to terminate the connection and Stomp session.
         * @param {Object} spec a configuration object. 
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * The overrides are the usual ones (@see Stomple.ClientPrototype).
         * Stomp headers can be set explicitly by providing an 'options' property in 
         * spec which is an object of header-value properties. E.g.,
         * {
         *   options: {
         *      headers: {
         *         transaction: 't42'
         *      }
         *   }
         * }
         */
        disconnect: function(spec) {
            this.checkConnectAndDo(this.doDisconnect, spec);
        },
        /**
         * Closes the underlying WebSocket. If disconnectOnClose is true, then
         * a Stomp DISCONNECT frame is sent to server first.
         * @param {Object} spec a configuration object. 
         * Has optional success and failure 
         * callback functions one of which is guaranteed to be called eventually depending
         * on the outcome of the command.
         * Overrides: disconnectOnClose, timeout, (TODO more)
         */
        close: function(spec) {
            spec = spec || {};
            var that = this,
                closefn = function(){that.close();};
            if (this.connected && (this.disconnectOnClose || spec.disconnectOnClose)) {
                this.disconnect({
                    success:closefn,
                    failure: closefn
                });
            }
            if (this.websocket) {
                this.websocket.close();            
            }
        },
        
        /**
         * Private. checks whether we are connected and performs action if so.
         * Otherwise connects if autoConnect, or throws error otherwise.
         * @param {Function} action
         * @param {spec} configuration object. 
         */
         checkConnectAndDo: function(action, spec) {
            var that = this;
            if (!this.connected) { 
                if (this.autoConnect || spec && spec.autoConnect) {
                    this.connect(Object.create(spec, {
                      success: {value: function() {
                           action.call(that, spec);
                      }}          
                    }));
                } else {
                    throw new Error("Not connected (and autoConnect is false)");
                }  
            } else {
                action.call(this, spec);
            }
        },
        /**
         * Private. Perform Connect
         * @param {spec} configuration object. 
         */
        doConnect: function(spec) {
            var that = this,
                w = that.websocket = new WebSocket(that.url),
                f = make_frame({
                    command:"CONNECT",
                    headers: {
                        login: spec.login || that.login,
                        passcode: spec.passcode || that.passcode
                    } 
                });
            if (Stomple.debug && logAvailable) {
                console.log(">>>>\n"+f.toString());//TODO: devel only
            }
            that.connectTimeoutId = setTimeout(function(){
                that.handleConnectFailed({reason: 'timeout', frame: f, websocket: w});
            }, spec.timeout || that.timeout);
            
            w.onopen    = function() {that.handleOpen(f, spec);};
            w.onmessage = function(msg) {that.handleMessage(msg);};
            w.onclose   = function(e) {that.handleClose(e);};
            w.onerror   = function() {that.handleError();};
        },
        /**
         * Private. Template method for all Stomp actions. Callbacks for various stages:
         * beforeSend, onSend, onTimeout, success, failure
         * @param {Object} spec configuration object...
         * @return {Object/boolean} false if websocket send fails, sent frame otherwise.
         */
        transmitFrame: function(config) {
            var spec = config.spec,
                cmd = config.command,
                that = this,
                f = this.makeClientFrame(cmd, spec),
                timeoutId,
                hasFail = typeof spec.failure === 'function', 
                receipt = f.headers.receipt;
            if (typeof config.beforeSend === 'function') {
                config.beforeSend(f);
            }
            if (Stomple.debug && logAvailable) {
                console.log(">>>>\n"+f.toString());//TODO: devel only
            }
                
            if (this.websocket.send(f.toString())) {
                if (typeof config.onSend === 'function') {
	                config.onSend(f);
	            }
                if (receipt) {
                    timeoutId = setTimeout(function(){
	                    if (typeof config.onTimeout === 'function') {
	                        config.onTimeout(f);
	                    }
	                    if (receipt) {
	                        delete that.pending[receipt];
	                    }
	                    if (hasFail) {
	                       spec.failure({reason: "timeout", frame: f, websocket: this.websocket});
	                    }
	                }, spec.timeout || this.timeout);
                    if (typeof config.makeReceiptHandler === 'function') {
                        this.pending[receipt] = config.makeReceiptHandler(spec,timeoutId, f);
                    } else {
                        this.pending[receipt] = this.makeReceiptHandler(spec,timeoutId,f);
                    }
                } else {
                    if (typeof spec.success === 'function') {
                        spec.success(f);   
                    }
                }
                return f;
            } else {
                if (typeof config.onFail === 'function') {
                    config.onFail(f);
                }
                if (hasFail) {
                  spec.failure({reason: 'io', frame: f, websocket: this.websocket});
                }
                return false;
            }
        },
        /**
         * Private. Perform send
         * @param {spec} configuration object. 
         */
        doSend: function(spec) {
            return this.transmitFrame({
                command: 'SEND',
                spec: spec
            });
        },
        
        /**
         * Private. Perform Subscribe
         * @param {spec} configuration object. 
         */
        doSubscribe: function(spec) {
             var that = this;
             return this.transmitFrame({
	                command: 'SUBSCRIBE',
	                spec: spec,
                    onTimeout: function(f) {
                        var dest = f.headers.destination;
                        that.removeSubscriber(dest, spec);
                    },
                    onSend: function (f) {
                        var dest = f.headers.destination;
                        that.subscribers[dest] = that.subscribers[dest] || []; 
                        that.subscribers[dest].push(spec);
                    },
                    makeReceiptHandler: function(spec, timeoutId, f) {
                        var dest = f.headers.destination;
	                    return that.makeReceiptHandler(Object.create(spec, {
	                        failure: {
	                           value: function(info) {
	                               that.removeSubscriber(dest, spec);
	                               if (typeof spec.failure === 'function') {
	                                   spec.failure(info);
	                               }
	                           }
	                        }
	                     }), timeoutId, f);
                    }
             });
        },
        /**
         * Private. Perform Un-Subscribe
         * @param {spec} configuration object. 
         */
        doUnsubscribe: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'UNSUBSCRIBE',
                    spec: spec,
                    beforeSend: function (f) {
	                    var dest = f.headers.destination;
	                    that.removeSubscriber(dest,spec);
	                }
             });
        },
        /**
         * Private. Perform begin
         * @param {spec} configuration object. 
         */
        doBegin: function(spec) {
            var that = this,
                tid, trans;
            tid = spec.transaction;
            if (typeof tid === "undefined" || tid === null) {
                tid = this.session + "-t-" + (++this.transid);  
            } 
            trans = {id: tid, msgs:[]};

            return this.transmitFrame({
                    command: 'BEGIN',
                    spec: spec,
                    beforeSend: function (f) {
                        f.headers.transaction = tid; 
                    },
                    onSend: function (f) {
                        that.transactions.push(trans);
                    },
                    onTimeout: function(f) {
                        that.removeTransaction(trans);
                    },
                    makeReceiptHandler: function(spec, timeoutId, f) {
                        return that.makeReceiptHandler(Object.create(spec, {
	                        failure: {
	                           value: function(info) {
	                               that.removeTransaction(trans);
	                               if (typeof spec.failure === 'function') {
	                                   spec.failure(info);
	                               }
	                           }
	                        }
	                     }), timeoutId, f);
                    }
             });
        },
        
        /**
         * Private. Perform commit
         * @param {spec} configuration object. 
         */
        doCommit: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'COMMIT',
                    spec: spec,
                    beforeSend: function (f) {
                        that.transactions.pop();
                    }
            });
        },
        
        /**
         * Private. Perform ack
         * @param {spec} configuration object. 
         */
        doAck: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'ACK',
                    spec: spec
            });
        },
        
        /**
         * Private. Perform abort
         * @param {spec} configuration object. 
         */
        doAbort: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'ABORT',
                    spec: spec,
                    beforeSend: function (f) {
                        that.transactions.pop();
                    }
            });
        },
        
        /**
         * Private. Perform disconnect
         * @param {spec} configuration object. 
         */
        doDisconnect: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'DISCONNECT',
                    spec: spec,
                    beforeSend: function(f) {
                        //consider us disconnected regardless of outcome
                        that.connected = false;
                        that.connectConfig = null;
                    }
            });
        },
        
        /**
         * Private. Handle connect success. Initializes state (connected, session, ...)
         * Calls callbacks onConnect and connectConfig.success.
         * @param {spec} configuration object. 
         */
        handleConnect: function(info) {
            var f = info.frame;
            if (this.connectTimeoutId) {
                clearTimeout(this.connectTimeoutId);
                this.connectTimeoutId = null;
            }
            this.connected = true;
            this.session = f.headers.session || '';
            this.msgid = 0;
            this.transid = 0;
            this.onConnect(info);
            if (this.connectConfig && 
                 typeof this.connectConfig.success === 'function') {
                 this.connectConfig.success(info);
            }
        },
        
        /**
         * Private. Handle connect failed. Cleans state (connected, session, ...)
         * Calls callbacks connectFailed and connectConfig.failure.
         * @param {spec} configuration object. 
         */
        handleConnectFailed: function(info) {
            if (this.connectTimeoutId) {
                clearTimeout(this.connectTimeoutId);
                this.connectTimeoutId = null;
            }
            this.connectFailed(info);
            if (this.connectConfig && 
                 typeof this.connectConfig.failure === 'function') {
                 this.connectConfig.failure(info);
            }
            this.connected = false;
            this.session = null;
            this.msgid = null;
            this.transid = null;
            if (this.closeOnError) {
                this.websocket.close();
            }
        },
        
        /**
         * Private. Handle websocket open failed. Sends connect frame.
         * @param {spec} configuration object. 
         */
        handleOpen: function(f, spec) {
            if (this.socketOpen(f) === false) {
                this.websocket.close();
                return;
            }
            this.websocket.send(f.toString());
        },
        
        /**
         * Private. Handle websocket close. Calls callbacks
         * socketClose, clears connect timeout if present. calls this.destroy.
         * If connectConfig.failure is present it is called.
         * @param {spec} configuration object. 
         */
        handleClose: function(info) {
            this.socketClose(info);
            if (this.connectTimeoutId) {
                clearTimeout(this.connectTimeoutId);
                if (this.connectConfig && 
	                 typeof this.connectConfig.failure === 'function') {
	                 this.connectConfig.failure(info);
	            }
            }
            this.destroy();
        },
        
        /**
         * Private. Handle websocket error. Calls callbacks
         * socketError, clears connect timeout if present. Closes websocket
         * if this.closeOnError.
         * If connectConfig.failure is present it is called.
         * @param {spec} configuration object. 
         */
        handleError: function() {
            if (this.socketError() !== false && this.closeOnError) {
                if (this.connectTimeoutId) {
	                clearTimeout(this.connectTimeoutId);
                    if (this.connectConfig && 
	                     typeof this.connectConfig.failure === 'function') {
	                     this.connectConfig.failure();
	                }
	            }
                if (this.websocket) {
                    this.websocket.close();
                }
            }
            
        },
        
        /**
         * Private. Handle websocket message. Calls callbacks
         * socketMessage. Parses Stomp message and calls,
         * message, error, connect, or receipt depending on server frame.
         * Handles message details (e.g. content-length).
         * @param {msg} configuration object. 
         */
        handleMessage: function(msg) {
            if (this.socketMessage(msg) === false) {
                return;//cancel
            }            
            var data = msg.data,
                i = data.indexOf(NL),
                N,
                cmd = data.substring(0,i),
                headersAndBody = data.substring(i+1),
                regexpRes = null,
                headerExp = /(.+):(.+)/g,
                bodyIdx = headersAndBody.indexOf('\n\n'),
                headerStr = headersAndBody.substring(0,bodyIdx),
                headers = {},
                subs,sub,//subscribers
                body = headersAndBody.substring(bodyIdx+2),
                contentLength,
                handlerSpec;
            
            while ((regexpRes = headerExp.exec(headerStr))) {
                headers[trim(regexpRes[1])] = trim(regexpRes[2]);
            }
            
            contentLength = headers['content-length'];
            if (contentLength) {
                try {
                  contentLength = parseInt(contentLength, 10);
                } catch (e) {
                    //bad contentLength ignore...
                    contentLength = null;
                }
            }
           
            
            if (contentLength) {
                body = body.substring(0, computeStringLength(body, contentLength));
            } else {
                i  = body.indexOf(NULL);
                body = body.substring(0, (i === -1) ? body.length : i);
            }
            
            var f = make_frame({
                command: cmd,
                headers: headers,
                body: body
            });
            if (Stomple.debug && logAvailable) {
                console.log("<<<<\n"+f.toString());//TODO: devel only
            }
                
            switch (cmd) {
                case "CONNECTED":
                    this.handleConnect({frame: f, websocket: this.websocket});
                    break;
                case "MESSAGE":
                    subs = this.subscribers[headers.destination];
                    if (subs) {
                        for (i=0,N=subs.length;i<N;i+=1) {
                            sub = subs[i];
                            sub.handler.call(sub.thisObj || globalObject,f);
                        }
                    }
                    break;
                case "RECEIPT":
                    handlerSpec = this.pending[headers['receipt-id'] || "0"];
                    if (handlerSpec && typeof handlerSpec.success === 'function') {
                        handlerSpec.success(handlerSpec.frame);
                    }
                    if (typeof this.onReceipt === 'function') {
                        this.onReceipt(handlerSpec.frame);
                    }
                    break;
                
                case "ERROR": 
                    handlerSpec = this.pending[headers['receipt-id'] || "0"];
                    if (handlerSpec && typeof handlerSpec.failure === 'function') {
                        handlerSpec.failure(handlerSpec.frame);
                    }
                    if (typeof this.onError === 'function') {
                        this.onError(handlerSpec.frame);
                    }
                    break;
            }             
            
        },
        
        makeClientFrame: function(command, spec) {
            var frameHeaders = {destination: spec.destination || this.destination},
                frameSpec = {
                    command: command, 
                    headers: frameHeaders,
                    body: spec.body
                },
                opts = spec.options || {},
                receipt;
            if ((opts.receipt !== false) && (this.autoReceipt || opts.receipt)) {
                frameHeaders.receipt = opts.receipt || this.session + "-m-" + (++this.msgid);
            }
            if (command !== "SUBSCRIBE" &&
                (opts.contentLength !== false)  && 
                  (this.autoContentLength || (typeof opts.contentLength === 'number' ||  opts.contentLength))) {
                if (typeof opts.contentLength === 'number') {
                    frameHeaders['content-length'] = ""+opts.contentLength;
                } else {
                    frameHeaders['content-length'] = ""+computeContentLength(spec.body);
                }
            }
            if ((opts.transaction !== false) && (this.transactions.length > 0 || opts.transaction)) {
                frameHeaders.transaction = opts.transaction || this.transactions[this.transactions.length-1].id;
            }
            if (opts.headers) {
                copyTo(frameHeaders, opts.headers);
            }
            return make_frame(frameSpec);
        },
        
        makeReceiptHandler: function (spec,timeoutId,f) {
            return {
                  success: function() {
                      clearTimeout(timeoutId);
                      if (typeof spec.success === 'function') {
                          spec.success(f);
                      }
                  },
                  failure: function(info) {
                      clearTimeout(timeoutId);
                      if (typeof spec.failure === 'function') {
                          spec.failure(info);
                      }
                  },
                  frame: f
              };
        },

        removeSubscriber: function(dest,s) {
            var subs = this.subscribers[dest],
                N;
            if (subs) {
                N = subs.length;
	            while (N--) {
	                if (subs[N] === s) {
	                    subs.splice(N,1);
	                    return s;
	                }
	            }
            }
            return false;
        },
        
        removeTransaction: function(t) {
            var trans = this.transactions,
                N = trans.length;
            while (N--) {
                if (trans[N] === t) {
                    trans.splice(N,1);
                    return t;
                }
            }
            return false;
        },
        
        removeTransactionById: function(tid) {
            var trans = this.transactions,
                N = trans.length;
            while (N--) {
                if (trans[N].id === tid) {
                    tid = trans[N]; 
                    trans.splice(N,1);
                    return tid;
                }
            }
            return false;
        },
        
        destroy: function() {
            this.connected = false;
            this.session = null;
            this.msgid = null;
            this.transid = null;
            this.websocket = null;
            this.connectConfig = null;
            this.connectTimeoutId = null;
            this.pending = null;
            this.subscribers = null;
            this.transactions = null;
            this.url = null;
            this.destination = null;
            this.login = null;
            this.passcode = null;
        }
    };
    
    /**
     * Creates a Stomple client object.
     * @param {Object} spec configuration object. Each of the prototype properties
     * can be overridden by specifying properties on the configuration object.
     * The url property is mandatory. If destination property is specified, then
     * this becomes the default destination for all Stomp methods with destinations.
     * Properties login and passcode are used to connect.
     * @return {Object} Stomple client object with Stomple.ClientPrototype as its prototype.
     * 
     */
    var create_client = function(spec) {
        var url = spec.url,
            destination = spec.destination;
        if (!url || typeof (url = url.valueOf()) !== 'string') {
            throw TypeError("Must supply url of type string when calling create_client");
        }
        var defaultValues = {
            pending:      {value: []},
            subscribers:  {value: []},
            transactions: {value: []},
            login:        {value: ""}, 
            passcode:     {value: ""}
        };
        return Object.create(ClientPrototype, copyTo(defaultValues, spec, true));
    };
  
    /**
     * Public interface
     */
	Stomple = {
        create_client: create_client,
        ClientPrototype: ClientPrototype,
        FramePrototype: FramePrototype,
        debug: false //debug will log all input and output Stomp messages.
    };

    globalObject.Stomple = Stomple;

})();
