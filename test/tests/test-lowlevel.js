var test_lowlevel;

YUI({ logInclude: { TestRunner: true } }).use("test",'console',  function(Y){
	test_lowlevel = {
	   
       name: "Test low-level callbacks",
	   
       "connecting should trigger lowlevel callbacks" : function() {
	        var status = "",
                openCalled = false,
                messageCalled = false,
                closeCalled = false,
                errorCalled = false;
            
            var client = Stomple.create_client({
                url : "ws://localhost:61614/stomp",
                destination : "jms.topic.chat",
                login : "guest",
                passcode : "guest",
                socketOpen: function(frame) {
                    Y.Assert.areSame("", status);
                    Y.Assert.areSame("CONNECT", frame.command);
                    status = "OPEN";
                    openCalled = true;
                },
                socketMessage: function(frame) {
                    Y.Assert.areSame("OPEN", status);
                    status = "MESSAGE"; 
                    messageCalled = true;
                },
                socketClose: function(){
                    Y.Assert.areSame("MESSAGE", status);
                    closeCalled = true;
                },
                socketError: function() {
                    //not sure how to trigger this easily..
                    errorCalled = true;
                }
            });
            client.connect({});
	        this.wait(function(){
                //Y.Assert.isTrue(ok, "Success was not called within 500 ms.");
                client.close();
                Y.Assert.isTrue(openCalled, "socketOpen not called.");
                Y.Assert.isTrue(messageCalled, "socketMessage not called.");
                this.wait(function(){
                    Y.Assert.isTrue(closeCalled, "socketClose not called.");
                },10);
            },500);
	    }
	
	};
});
		