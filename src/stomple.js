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
* @version 0.9 (beta)
*/
(function() {
    var globalObject = this,
        Stomple,
        emptyFn = function() {},
        warnAvailable = globalObject.console && typeof globalObject.console.warn === 'function',
        infoAvailable = globalObject.console && typeof globalObject.console.info === 'function',
        trim;
    if (typeof WebSocket === 'undefined' ||  !WebSocket || globalObject.Stomple) {
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
         * object function Modified to match EcmaScript 5th edtion Object.create
         * (no support for setting other properties than value, though).
         * 
         * @see http://www.ecma-international.org/publications/standards/Ecma-262.htm
         * @see http://groups.google.com/group/comp.lang.javascript/msg/e04726a66face2a2
         * @param {Object} origin
         * @param {Object} props a specification object describing overrides as in
         *            EcmaScript 5th edition Object.create. Only supported
         *            specification objects have a single property named value,
         *            e.g. {value: 42}.
         * @return {Object} object with <code>origin</code> as its prototype
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
     * @param {Object} body the string to compute on
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
     * @param {Object} body the string to compute on
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
    
    
    var NULL = '\u0000';
        
     /*
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
            res += '\n';
	        if (hds) {
	          for (h in hds) {
	            if(hds.hasOwnProperty(h)) {
                    res += h;
                    res += ':';
                    res += hds[h];
                    res += '\n';
	            }
	          }
	        }
	        res += '\n';
	        if (this.body) {
	          res += this.body;
	        }
            res += NULL;
	        return res;
        }
    };
    
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
    
    var ClientPrototype = {
        
        timeout: 8000,        
        autoConnect: true,
        autoContentLength: true,
        autoReceipt: true,
        closeOnError: true,
        
        onConnect: emptyFn,
        connectFailed: emptyFn,
        onError: emptyFn,
        onReceipt: emptyFn,
      
		socketOpen: emptyFn,
        socketMessage: emptyFn,
        socketClose: emptyFn,
		socketError: emptyFn,
        
        connected: false,
        websocket: null,
        session: null,
        connectConfig: null,
        connectTimeoutId: null,
        msgid: null,
        transid: null,
        pending: null,
        subscribers: null,
        transactions: null,
        url: null,
        destination: null,
        login: null,
        passcode: null,
        
        connect: function(spec) {
            if (this.connected) {
                throw new Error("Called connect when in connected state.");
            }
            this.connectConfig = spec;
            this.doConnect(spec);
        },
        
        send: function(spec) {
            this.checkConnectAndDo(this.doSend, spec);
        },
        
        subscribe: function(spec) {
            this.checkConnectAndDo(this.doSubscribe,spec);
        },
        
        unsubscribe: function(spec) {
            this.checkConnectAndDo(this.doUnsubscribe, spec);
        },
        
        begin: function(spec) {
            this.checkConnectAndDo(this.doBegin, spec);
        },
        
        commit: function(spec) {
            this.checkConnectAndDo(this.doCommit, spec);
        },
        
        ack: function(spec) {
            this.checkConnectAndDo(this.doAck, spec);
        },
        
        abort: function(spec) {
            this.checkConnectAndDo(this.doAbort, spec);
        },
        
        disconnect: function(spec) {
            this.checkConnectAndDo(this.doDisconnect, spec);
        },
        
        close: function(spec) {
            spec = spec || {};
            if (this.disconnectOnClose || spec.disconnectOnClose) {
                //this.checkConnectAndDo(this.doDisconnect, spec);
            }
            if (this.websocket) {
                this.websocket.close();            
            }
        },
        
        checkConnectAndDo: function(action, spec, actionName) {
            var that = this;
            if (!this.connected) { 
                if (this.autoConnect) {
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
        
        doConnect: function(spec) {
            var that = this,
                w = this.websocket = new WebSocket(this.url),
                f = make_frame({
                    command:"CONNECT",
                    headers: {
                        login: spec.login || this.login,
                        passcode: spec.passcode || this.passcode
                    } 
                });
            if (Stomple.debug)
                console.log(">>>>\n"+f.toString());//TODO: devel only
            this.connectTimeoutId = setTimeout(function(){
                that.connectTimeoutId = null;
                that.handleConnectFailed({reason: 'timeout', frame: f, websocket: this.websocket});
            }, spec.timeout || this.timeout);
            
            w.onopen    = function() {that.handleOpen(f, spec);};
            w.onmessage = function(msg) {that.handleMessage(msg);};
            w.onclose   = function(e) {that.handleClose(e);};
            w.onerror   = function() {that.handleError();};
        },
        
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
            if (Stomple.debug)
                console.log(">>>>\n"+f.toString());//TODO: devel only
            if (this.websocket.send(f.toString())) {
                if (typeof config.onSend === 'function') {
	                config.onSend(f);
	            }
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
                if (receipt) {
                    if (typeof config.makeReceiptHandler === 'function') {
                        this.pending[receipt] = config.makeReceiptHandler(spec,timeoutId, f);
                    } else {
                        this.pending[receipt] = this.makeReceiptHandler(spec,timeoutId,f);
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
        
        doSend: function(spec) {
            return this.transmitFrame({
                command: 'SEND',
                spec: spec
            });
        },
        
        
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
        
        doAck: function(spec) {
            var that = this;
            return this.transmitFrame({
                    command: 'ACK',
                    spec: spec
            });
        },
        
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
        
        doDisconnect: function(spec) {
            return this.transmitFrame({
                    command: 'DISCONNECT',
                    spec: spec
            });
        },
        
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
        
        handleConnectFailed: function(info) {
            if (this.connectTimeoutId) {
                clearTimeout(this.connectTimeoutId);
                this.connectTimeoutId = null;
            }
            this.connected = false;
            this.session = null;
            this.msgid = null;
            this.transid = null;
            this.connectFailed(info);
            if (this.connectConfig && 
                 typeof this.connectConfig.failure === 'function') {
                 this.connectConfig.failure(info);
            }
        },
        
        handleOpen: function(f, spec) {
            if (this.socketOpen(f) === false) {
                this.websocket.close();
                return;
            }
            this.websocket.send(f.toString());
        },
        
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
                
        handleMessage: function(msg) {
            if (this.socketMessage(msg) === false) {
                return;//cancel
            }            
            var data = msg.data,
                i = data.indexOf('\n'),
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
            if (Stomple.debug)
                console.log("<<<<\n"+f.toString());//TODO: devel only
            switch (cmd) {
                case "CONNECTED":
                    this.handleConnect({frame: f, websocket: this.websocket});
                    break;
                case "MESSAGE":
                    subs = this.subscribers[headers.destination];
                    if (subs) {
                        for (i=0,N=subs.length;i<N;i+=1) {
                            sub = subs[i];
                            sub.handler.call(sub.scope || globalObject,f);
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
  
	Stomple = {
        create_client: create_client,
        ClientPrototype: ClientPrototype,
        FramePrototype: FramePrototype,
        debug: false
    };

    globalObject.Stomple = Stomple;

})();
