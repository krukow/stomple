var test_transaction;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_transaction = {
	   
       name: "Test transaction",
	 
	    //---------------------------------------------
	    // Setup and tear down
	    //---------------------------------------------
	 
	    setUp : function() {
	        this.client = Stomple.create_client({
	            url : "ws://localhost:61614/stomp",
	            destination : "jms.topic.chat",
	            login : "guest",
	            passcode : "guest"
	        });
	    },
	
	    tearDown : function() {
            this.client.close();
	    },
	
	    
           
        "Should receive transactionally on commit" : function() {
            var setupFailed = true,
                received = [],
                msgBodies = ["1","2","3"];
            this.client.subscribe({
                success: function(frame) {
                    setupFailed = false;
                },
                handler: function(msg) {
                    received.push(msg.body);
                },
                thisObj: this.client
            });
            
            this.wait(function(){
                if (setupFailed) {
                    Y.Assert.fail("Cannot run test: since subscription failed");
                } else {
                    setupFailed = true;
                    this.client.begin({
                        failure: function() {
                            Y.Assert.fail("Begin transaction failed.");
                        },
                        success: function(){ setupFailed = false;}
                    });
                    this.wait(function(){
                         var i,N = msgBodies.length,
                            sendFailed = function() {
                                        Y.Assert.fail("send failed.");
                                   };
                         if (setupFailed) {
                            Y.Assert.fail("Cannot run test: Begin transaction failed");
                         } else {
                           for (i=0;i<N;i+=1) {
                                this.client.send({
                                   body: ""+msgBodies[i],
                                   failure: sendFailed
                               });
                               
                           }
                           this.wait(function(){
                                Y.Assert.areSame(0, received.length,"Received messages before commit");
                                setupFailed = true;
                                this.client.commit({
                                    failure: function() {
                                        Y.Assert.fail("Commit transaction failed.");
                                    },
                                    success: function(){setupFailed = false;}
                                });
                                this.wait(function(){
                                     var i,N = msgBodies.length;
                                     if (setupFailed) {
                                        Y.Assert.fail("Cannot run test: Commit transaction failed");
                                     } else {
                                        for (i=0;i<N;i+=1) {
                                           Y.Assert.areSame(msgBodies[i],received[i],"Received: "+received[i]+" send order: "+msgBodies[i]);
                                       }
                                     }
                                }, 500);
                           },500);
                        }
                    },500);
                }
            },500);
        },
        
        "Should not receive on abort" : function() {
                var setupFailed = true,
                    received = false,
                    okMsg = "OK",
                    msgBodies = ["1","2","3"];
                this.client.subscribe({
                    success: function(frame) {
                        setupFailed = false;
                    },
                    handler: function(msg) {
                        if (msg.body !== okMsg) {
                            Y.Assert.fail("Received message: "+msg.body);
                        } else {
                            received = true;
                        }
                        
                    },
                    thisObj: this.client
                });
                
                this.wait(function(){
                    if (setupFailed) {
                        Y.Assert.fail("Cannot run test: since subscription failed");
                    } else {
                        setupFailed = true;
                        this.client.begin({
                            failure: function() {
                                Y.Assert.fail("Begin transaction failed.");
                            },
                            success: function(){ setupFailed = false;}
                        });
                        this.wait(function(){
                             var i,N = msgBodies.length,
                                sendFailed = function() {
                                            Y.Assert.fail("send failed.");
                                       };
                             if (setupFailed) {
                                Y.Assert.fail("Cannot run test: Begin transaction failed");
                             } else {
                               for (i=0;i<N;i+=1) {
                                    this.client.send({
                                       body: ""+msgBodies[i],
                                       failure: sendFailed
                                   });
                                   
                               }
                               this.wait(function(){
                                    setupFailed = true;
                                    this.client.abort({
                                        failure: function() {
                                            Y.Assert.fail("Commit transaction failed.");
                                        },
                                        success: function(){setupFailed = false;}
                                    });
                                    this.wait(function(){
                                         if (setupFailed) {
                                            Y.Assert.fail("Cannot run test: Commit transaction failed");
                                         }
                                         setupFailed = true;
                                         this.client.send({
                                           body: okMsg,
                                           failure: function() {
                                                Y.Assert.fail("send failed.");
                                           },
                                           success: function(){ setupFailed = false;}
                                         });
                                         this.wait(function(){
                                             if (setupFailed) {
                                                Y.Assert.fail("Cannot run test: Commit transaction failed");
                                             }
                                             Y.Assert.isTrue(received, "did not receive non-transactional message.");
                                         },500);
                                    }, 500);
                               },500);
                            }
                        },500);
                    }
                },500);
            },
            
            /**
             * This test is a complex nested transaction.
             * In an "outer" transaction, messages "A" and "B" are sent.
             * Then an inner transaction is started, and messages "1","2","3"
             * are sent. The inner transaction then aborts.
             * Then message "C" is sent (now running in the 'outer' trans).
             * Finally, the outer transaction is commited.
             * Expect: receive "A","B","C" 
             */
            "Should abort inner and commit outer in Nested transaction" : function() {
	            var setupFailed = true,
	                received = [],
	                outerBodies = ["A","B","C"],
	                innerBodies = ["1","2","3"];
	            this.client.subscribe({
	                success: function(frame) {
	                    setupFailed = false;
	                },
	                handler: function(msg) {
	                    received.push(msg.body);
	                },
	                thisObj: this.client
	            });
            
		            this.wait(function(){
		                if (setupFailed) {
		                    Y.Assert.fail("Cannot run test: since subscription failed");
		                } else {
		                    setupFailed = true;
		                    this.client.begin({
		                        failure: function() {
		                            Y.Assert.fail("Begin transaction failed.");
		                        },
		                        success: function(){ setupFailed = false;}
		                    });
		                    this.wait(function(){
		                         var i,N = outerBodies.length-1,
                                    sendFailed = function() {
                                                Y.Assert.fail("send failed.");
                                           };
		                         if (setupFailed) {
		                            Y.Assert.fail("Cannot run test: Begin transaction failed");
		                         } else {
		                           for (i=0;i<N;i+=1) {
		                                this.client.send({
		                                   body: ""+outerBodies[i],
		                                   failure: sendFailed
		                               });
		                           }
		                           this.wait(function(){
		                                Y.Assert.areSame(0, received.length,"Received messages before commit");
		                                setupFailed = true;
		                                this.client.begin({
		                                    failure: function() {
		                                        Y.Assert.fail("Begin inner transaction failed.");
		                                    },
		                                    success: function(){ setupFailed = false;}
		                                });
		                                this.wait(function(){
                                            Y.Assert.areSame(2, this.client.transactions.length);
                                                                    //two pending transactions
		                                     var i,N = innerBodies.length,
                                                 sendFailed = function() {
		                                                Y.Assert.fail("send failed.");
		                                           };
		                                     if (setupFailed) {
		                                        Y.Assert.fail("Cannot run test: Begin inner transaction failed");
		                                     } else {
		                                       for (i=0;i<N;i+=1) {
		                                            this.client.send({
		                                               body: ""+innerBodies[i],
		                                               failure: sendFailed
		                                            });
		                                       }
		                                       this.wait(function(){
		                                            setupFailed = true;
		                                            this.client.abort({
		                                                failure: function() {
		                                                    Y.Assert.fail("Abort transaction failed.");
		                                                },
		                                                success: function(){setupFailed = false;}
		                                            });
		                                            this.wait(function(){
		                                                 if (setupFailed) {
		                                                    Y.Assert.fail("Cannot run test: Abort transaction failed");
		                                                 }
		                                                 setupFailed = true;
		                                                 this.client.send({
							                                   body: ""+outerBodies[outerBodies.length-1],
							                                   failure: function() {
							                                        Y.Assert.fail("send failed.");
							                                   },success: function(){setupFailed = false;}
						                                 });
		                                                 
		                                                 this.wait(function(){
		                                                     if (setupFailed) {
			                                                    Y.Assert.fail("Cannot run test: send last outer message failed");
			                                                 }
		                                                     this.client.commit({
		                                                        failure: function() {
							                                        Y.Assert.fail("Commit transaction failed.");
							                                    },
							                                    success: function(){setupFailed = false;}
		                                                     });
		                                                     this.wait(function(){
							                                     var i,N = outerBodies.length;
							                                     if (setupFailed) {
							                                        Y.Assert.fail("Cannot run test: Commit transaction failed");
							                                     } else {
		                                                            Y.Assert.areSame(outerBodies.length,received.length,"Did not receive exactly: "+outerBodies.length);
							                                        for (i=0;i<N;i+=1) {
							                                           Y.Assert.areSame(outerBodies[i],received[i],"Received: "+received[i]+" send order: "+outerBodies[i]);
							                                        }
                                                                    Y.Assert.areSame(0, this.client.transactions.length);
                                                                    //no pending transactions
							                                     }
							                                }, 500);
		                                                 },500);
		                                                 
		                                            },500);
		                                        },500);
		                                      }
		                               },500);
		                           
					            },500);
					        }
		                    }, 500);
		                }
		            },500);
        }          
    
    };
          
});
		