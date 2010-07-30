var test_send;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_send = {
	   
       name: "Test send",
	 
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
	
	    "Send should cause a receive on jms.topic.chat" : function() {
	        var setupFailed = true,
                received,
                msgBody = "Send should cause a receive on jms.topic.chat";
            this.client.subscribe({
                success: function(frame) {
                    setupFailed = false;
                },
                handler: function(msg) {
                    received = msg.body;
                },
                thisObj: this
            });
            
            this.wait(function(){
                if (setupFailed) {
                    Y.Assert.fail("Cannot run test "+"Send should cause a receive on jms.topic.chat"+" since subscription failed");
                } else {
                    this.client.send({
		                body: msgBody,
		                failure: function() {
		                    Y.Assert.fail("send failed");
		                }
		            });
		            this.wait(function(){
		                Y.Assert.areSame(msgBody, received);
		            },500);
                }
            },500);
            
	    }
	};
});
		