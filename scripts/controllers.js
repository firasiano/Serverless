angular.module('myApp').controller('MainController', function($scope, UserService, $facebook, $interval, $location) {
    $scope.navbarCollapsed = true;
    $scope.signedIn = function(oauth) {
        UserService.setCurrentUser(oauth).then(function(user) {
            $scope.user = user;
            
            console.log($scope.user);
            console.log("this user is signed in");
        });
    };
    $scope.signIn = function(social){
        if(social === "facebook"){
            signInFacebook();
        }
        else if(social === "google"){
            $interval(function() {
                angular.element(document.querySelector("#___signin_0 button"))[0].click();}, 10, 1);
        }

    }
    var signInFacebook = function(){
        UserService.setLoginMethod("facebook");
        $facebook.login($scope.signedIn);
    }
    $scope.signOut = function() {
        $scope.user = null;
        UserService.logoutCurrentUser();
    };
    $scope.onFile = function(files, details) {
        UserService.uploadItemForSale(files, details).then(function(data) {
            // Refresh the current items for sale
        });
    };
    var getItemsForSale = function() {
        UserService.itemsForSale().then(function(images) {
            $scope.images = images;
        });
    }
    // Load the user's list initially
    var initiateUser = function() {
        if(!localStorage.getItem("sessionId")){
            UserService.initiateUser();
        }
    }
    initiateUser();
    getItemsForSale();
    $scope.sellImage = function(image) {
        $scope.showCC = true;
        $scope.currentItem = image;
    };
    $scope.submitPayment = function() {
        UserService.createPayment($scope.currentItem, $scope.charge).then(function(data) {
            $scope.showCC = false;
        });
    };
    $scope.goToUploading = function(){
        $location.path('/uploadItem');
    }


})
.controller('uploaderController', function($scope, UserService) {
    $scope.imageWidth = "200px";

    $scope.onFile = function(files, details) {
        UserService.uploadItemForSale(files, details).then(function(data) {
            // Refresh the current items for sale
        });
    };

    $scope.selectImage = function(input){
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                $scope.itemImageSrc = e.target.result;
                if(!$scope.$$phase){
                    $scope.$apply();
                }
            };

            reader.readAsDataURL(input.files[0]);
            $scope.itemImage = input.files;
        }
    };

    $scope.uploadItem = function(){
        if($scope.itemImage && $scope.itemPrice && $scope.itemDescription && $scope.daysForSale){
            var details = {
                price: $scope.itemPrice,
                description: $scope.itemDescription,
                daysForSale: $scope.daysForSale
            }
            $scope.onFile($scope.itemImage, details);
        }
    }
});
