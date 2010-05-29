var test_disconnect;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_disconnect = {
	   
       name: "Test disconnect",
	 
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
	
	    "Should call success callback on disconnect, no receipt" : function() {
	        var ok = false;
            this.client.subscribe({
                success: function(frame) {
                    ok = true;
                },
                failure: function(spec) {
                    var r = (spec && spec.reason) || "unknown";
                    Y.Assert.fail("Failure callback called, reason: "+r);  
                }
            
            });
	        this.wait(function(){
                Y.Assert.isTrue(ok, "Subscribe success was not called within 500 ms.");
                ok = false;
                this.client.disconnect({
                    options: {receipt:false},
	                success: function(frame) {
	                    ok = true;
	                },
	                failure: function(spec) {
	                    var r = (spec && spec.reason) || "unknown";
	                    Y.Assert.fail("Failure callback called, reason: "+r);  
	                }
                });
                //suceed immediately since no receipt is required.
                Y.Assert.isTrue(ok, "Disconnect success was not called within 500 ms.");
            },500);
	    }
	
	};
});
		