var test_client_ack;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_client_ack = {
	   
       name: "Test Client ACK",
	 
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
	
	    testAck : function() {
	        var ok = false,
                ackOk = false,
                count = 0,
                msgBody = "TO_BE_ACKed";
            this.client.subscribe({
                options:{headers: {ack:'client'}},
                success: function(frame) {
                    ok = true;
                },
                failure: function(spec) {
                    var r = (spec && spec.reason) || "unknown";
                    Y.Assert.fail("Failure callback called, reason: "+r);  
                },
                handler: function(msg) {
                    count += 1;
                    if (count === 1) {
                        this.client.ack({
                            options: {headers: {'message-id': msg.headers['message-id']}},
                            success: function() {
                                ackOk = true;
                            },
                            failure: function(spec) {
                                var r = (spec && spec.reason) || "unknown";
                                Y.Assert.fail("Failure callback called on ACK, reason: "+r);
                            }
                            
                        });
                    } else if (count >= 2) {
                        Y.Assert.fail("received "+count+" messages");  
                    }
                },
                thisObj: this
            });
	        this.wait(function(){
                Y.Assert.isTrue(ok, "Success was not called within 500 ms.");
                this.client.send({
                    body: msgBody,
                    failure: function() {
                        Y.Assert.fail("send failed");
                    }
                });
                this.wait(function(){
                    Y.Assert.areSame(1,count);
                    Y.Assert.isTrue(ackOk, "ackOk is false.");
                    
                },500);
            },500);
	    }
	
	};
});
		