angular.module('myApp.services', []).factory('UserService', function($q, $http, AWSService, $facebook) {
    var service = {
        loginMethod: null,
        _user: null,
        UsersTable: "Users",
        UserItemsTable: "UsersItems",
        setLoginMethod: function(m){
            service.loginMethod = m;
        },
        setCurrentUser: function(u) {
            if (u && !u.error) {
                AWSService.setToken(u.id_token, null, u);
                return service.currentUser();
            } else {
                var d = $q.defer();
                d.reject(u.error);
                return d.promise;
            }
        },
        logoutCurrentUser: function() {
            AWSService.unsetToken();
            console.log("in logout");
            if(service.loginMethod === "facebook"){
                        $facebook.logout();
                    }
                    else{
                        gapi.auth.signOut();
                    }
        },
        initiateUser: function(){
            AWSService.initialUser();
        },
        currentUser: function() {
            var d = $q.defer();
            if (service._user) {
                d.resolve(service._user);
            } else {
                AWSService.credentials().then(function() {
                    var register = function(e) {
                        var email = e.email;
                        // Get the dynamo instance for the
                        // UsersTable
                        AWSService.dynamo({
                            params: {
                                TableName: service.UsersTable
                            }
                        }).then(function(table) {
                            // find the user by email
                            table.getItem({
                                Key: {
                                    'User email': {
                                        S: email
                                    }
                                }
                            }, function(err, data) {
                                if (!data || Object.keys(data).length == 0) {
                                    // User didn't previously exist
                                    // so create an entry
                                    var itemParams = {
                                        Item: {
                                            'User email': {
                                                S: email
                                            },
                                            data: {
                                                S: JSON.stringify(e)
                                            }
                                        }
                                    };
                                    table.putItem(itemParams, function(err, data) {
                                        service._user = e;
                                        d.resolve(e);
                                    });
                                } else {
                                    // The user already exists
                                    service._user = JSON.parse(data.Item.data.S);
                                    d.resolve(service._user);
                                }
                            });
                        });
                    };
                    if(service.loginMethod === "facebook"){
                        $facebook.api("/me", null, null, register);
                    }
                    else if(service.loginMethod === "google"){
                        gapi.client.oauth2.userinfo.get().execute(register);
                    }
                    else{
                        AWSService.setToken();
                    }
                });
            }
            return d.promise;
        },
        Bucket: 'gumroad-example',
        uploadItemForSale: function(items, details) {
            var d = $q.defer();
            service.currentUser().then(function(user) {
                // Handle the upload
                AWSService.s3({
                    params: {
                        Bucket: service.Bucket
                    }
                }).then(function(s3) {
                    // We have a handle of our s3 bucket
                    // in the s3 object
                    var file = items[0]; // Get the first file
                    var params = {
                        Key: file.name,
                        Body: file,
                        ContentType: file.type
                    }
                    s3.putObject(params, function(err, data) {
                        // The file has been uploaded
                        // or an error has occurred during the upload
                        if (!err) {
                            var params = {
                                Bucket: service.Bucket,
                                Key: file.name,
                                Expires: 900 * 4 * 24 * details.daysForSale // 1 hour
                            };
                            s3.getSignedUrl('getObject', params, function(err, url) {
                                // Now we have a url
                                AWSService.dynamo({
                                    params: {
                                        TableName: service.UserItemsTable
                                    }
                                }).then(function(table) {
                                    var itemParams = {
                                        Item: {
                                            'ItemId': {
                                                S: file.name
                                            },
                                            'User email': {
                                                S: user.email
                                            },
                                            data: {
                                                S: JSON.stringify({
                                                    itemId: file.name,
                                                    itemSize: file.size,
                                                    itemUrl: url,
                                                    itemPrice: details.price,
                                                    itemDesciption: details.description
                                                })
                                            }
                                        }
                                    };
                                    table.putItem(itemParams, function(err, data) {
                                        d.resolve(data);
                                    });
                                });
                            });
                        }
                    });
                });
            });
            return d.promise;
        },
        itemsForSale: function() {
            var d = $q.defer();
            // service.currentUser().then(function(user) {
                AWSService.credentials().then( function(){
                    AWSService.dynamo({
                    params: {
                        TableName: service.UserItemsTable
                    }
                }).then(function(table) {
                    table.scan({
                        TableName: service.UserItemsTable
                        // KeyConditions: {
                        //     "User email": {
                        //         "ComparisonOperator": "EQ",
                        //         "AttributeValueList": [{
                        //             S: "eng.alkhouri@gmail.com"
                        //         }]
                        //     }
                        // }
                    }, function(err, data) {
                        var items = [];
                        if (data) {
                            angular.forEach(data.Items, function(item) {
                                items.push(JSON.parse(item.data.S));
                            });
                            d.resolve(items);
                        } else {
                            d.reject(err);
                        }
                    })
                // });
                });
            });
            return d.promise;
        },
        ChargeTable: "UserCharges",
        createPayment: function(item, charge) {
            var d = $q.defer();
            StripeService.createCharge(charge).then(function(data) {
                var stripeToken = data.id;
                AWSService.sqs({
                    QueueName: service.ChargeTable
                }).then(function(queue) {
                    queue.sendMessage({
                        MessageBody: JSON.stringify({
                            item: item,
                            stripeToken: stripeToken
                        })
                    }, function(err, data) {
                        d.resolve(data);
                    })
                })
            }, function(err) {
                d.reject(err);
            });
            return d.promise;
        },
    };
    return service;
}).provider('AWSService', function() {
    var self = this;
    self.arn = null;
    self.setArn = function(arn) {
        if (arn) self.arn = arn;
    };
    self.$get = function($q, $cacheFactory) {
        var dynamoCache = $cacheFactory('dynamo'),
            s3Cache = $cacheFactory('s3Cache'),
            sqsCache = $cacheFactory('sqs'),
            credentialsDefer = $q.defer(),
            credentialsPromise = credentialsDefer.promise;
        return {
            credentials: function() {
                return credentialsPromise;
            },
            initialUser: function() {
                var config = {
                    RoleArn: self.arn
                }
                AWS.config.credentials = new AWS.WebIdentityCredentials(config);

                AWS.config.update({secretAccessKey: "fOtoXJEM/u2r3AN2fLlyCHyUP84MKD37elvY5+Zm", accessKeyId: "AKIAJUWHPFXA5A2CXKSA"})
                AWS.config.region = 'us-east-1';
                self.config = config;
                
                if(!AWS.config.credentials.expired){
                    credentialsDefer.resolve(AWS.config.credentials);
                }
                else{
                    AWS.config.credentials.refresh(function(){
                        credentialsDefer.resolve(AWS.config.credentials);
                    });
                }
            },
            setToken: function(token, providerId, user) {
                if(user && user.status && user.status.google_logged_in){
                    self.arn = "arn:aws:iam::749316253858:role/google-web-role";
                }
                else if (user){
                    self.arn = "arn:aws:iam::749316253858:role/facebook-web-role";
                }
                var config = {
                    RoleArn: self.arn,
                    WebIdentityToken: token,
                    RoleSessionName: 'web-id'
                }
                AWS.config.credentials = new AWS.WebIdentityCredentials(config);
                AWS.config.region = 'us-east-1';
                if (providerId) {
                    config['ProviderId'] = providerId;
                }
                self.config = config;
                if(!AWS.config.credentials.expired){
                    credentialsDefer.resolve(AWS.config.credentials);
                    localStorage.setItem("sessionId", AWS.config.credentials.sessionToken);
                }
                else{
                    AWS.config.credentials.refresh(function(data){
                        credentialsDefer.resolve(AWS.config.credentials);
                        localStorage.setItem("sessionId", AWS.config.credentials.sessionToken);
                    });
                }
            },
            unsetToken: function() {
                AWS.config = {};
            },
            dynamo: function(params) {
                var d = $q.defer();
                // credentialsPromise.then(function() {
                    var table = null;//dynamoCache.get(JSON.stringify(params));
                    if (!table) {
                        var table = new AWS.DynamoDB(params);
                        dynamoCache.put(JSON.stringify(params), table);
                    };
                    d.resolve(table);
                // });
                return d.promise;
            },
            s3: function(params) {
                var d = $q.defer();
                credentialsPromise.then(function() {
                    var s3Obj = s3Cache.get(JSON.stringify(params));
                    if (!s3Obj) {
                        var s3Obj = new AWS.S3(params);
                        s3Cache.put(JSON.stringify(params), s3Obj);
                    }
                    d.resolve(s3Obj);
                });
                return d.promise;
            },
            sqs: function(params) {
                var d = $q.defer();
                credentialsPromise.then(function() {
                    var url = sqsCache.get(JSON.stringify(params)),
                        queued = $q.defer();
                    if (!url) {
                        var sqs = new AWS.SQS();
                        sqs.createQueue(params, function(err, data) {
                            if (data) {
                                url = data.QueueUrl;
                                sqsCache.put(JSON.stringify(params), url);
                                queued.resolve(url);
                            } else {
                                queued.reject(err);
                            }
                        });
                    } else {
                        queued.resolve(url);
                    }
                    queued.promise.then(function(url) {
                        var queue = new AWS.SQS({
                            params: {
                                QueueUrl: url
                            }
                        });
                        d.resolve(queue);
                    });
                })
                return d.promise;
            }
        }
    };
}).provider('StripeService', function() {
    var self = this;
    self.setPublishableKey = function(key) {
        Stripe.setPublishableKey(key);
    }
    self.$get = function($q) {
        return {
            createCharge: function(obj) {
                var d = $q.defer();
                if (!obj.hasOwnProperty('number') || !obj.hasOwnProperty('cvc') || !obj.hasOwnProperty('exp_month') || !obj.hasOwnProperty('exp_year')) {
                    d.reject("Bad input", obj);
                } else {
                    Stripe.card.createToken(obj, function(status, resp) {
                        if (status == 200) {
                            d.resolve(resp);
                        } else {
                            d.reject(status);
                        }
                    });
                }
                return d.promise;
            }
        }
    }
});;