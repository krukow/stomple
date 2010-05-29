var test_subscribe;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_subscribe = {
	   
       name: "Test subscribe",
	 
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
	
	    "Subscription should succeed and call success callback" : function() {
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
                Y.Assert.isTrue(ok, "Success was not called within 500 ms.");
            },500);
	    },
	
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
        }
	
	};
});
		