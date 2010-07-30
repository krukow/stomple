var test_unsubscribe;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_unsubscribe = {
	   
       name: "Test un-subscribe",
	 
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
	
	    "Subscription should not persist after un-subscribe" : function() {
            var setupFailed = true,
                received = null,
                msgBody = "Subscription should not persist after un-subscribe";
            this.client.subscribe({
                success: function(frame) {
                    setupFailed = false;
                },
                handler: function(msg) {
                    Y.Assert.fail("received unexpected message on "+this.destination);
                },
                thisObj: this.client
            });
            
            this.wait(function(){
                if (setupFailed) {
                    Y.Assert.fail("Cannot run test "+'Subscription should not persist after un-subscribe'+" since subscription failed");
                } else {
                    setupFailed = true;
                    this.client.unsubscribe({
                        failure: function() {
                            Y.Assert.fail("Unsubscribe failed.");
                        },
                        success: function(){ setupFailed = false;}
                    });
                    this.wait(function(){
                         if (setupFailed) {
		                    Y.Assert.fail("Cannot run test "+'Subscription should not persist after un-subscribe'+" since un-subscription failed");
			             } else {
                           this.client.send({
	                           body: msgBody,
	                           failure: function() {
	                                Y.Assert.fail("send failed.");
	                           }
	                       });
		                   this.wait(function(){
		                       Y.Assert.isNull(received);
		                   },500);
                        }
                    },500);
                }
            },500);
	    }/*,
	
	    "Subscription should fail and call failure callback" : function() {
	        var gotError = false;
            this.client.subscribe({
                destination: 'jms.topic.nonexistant',
                success: function(frame) {
                    Y.Assert.fail("called success callback when expecting failure");
                },
                failure: function(spec) {
                    //expected..
                    gotError = true;
                }
            
            });
            this.wait(function(){
                Y.Assert.isTrue(gotError, "Failure was not called within 500 ms.");
            },500);
	    },
        
        "Subscription should timeout and call failure callback" : function() {
            var gotError = false;
            this.client.subscribe({
                timeout:5,
                destination: 'jms.topic.chat',
                success: function(frame) {
                    Y.Assert.fail("called success callback when expecting failure");
                },
                failure: function(spec) {
                    //expected..
                    gotError = true;
                    Y.Assert.isObject(spec, "failure called without spec object");
                    Y.Assert.areSame("timeout",spec.reason);  
                }
            
            });
            this.wait(function(){
                Y.Assert.isTrue(gotError, "No timeout before 10 ms.");
            },10);
        }*/
	
	};
});
		