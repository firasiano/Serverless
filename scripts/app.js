angular.module('myApp', ['ui.bootstrap', 'ngRoute', 'myApp.services', 'myApp.directives', 'facebook']).config(function($routeProvider, AWSServiceProvider) {

    $routeProvider.when('/', {
        controller: 'MainController',
        templateUrl: 'templates/main.html',
    })
    .when('/uploadItem', {
        controller: 'uploaderController',
        templateUrl: 'templates/uploadItem.html'
    }).otherwise({
        redirectTo: '/',
        controller: 'MainController'
    });
    AWSServiceProvider.setArn('arn:aws:iam::749316253858:role/public');
})
.config(function(StripeServiceProvider) {
	StripeServiceProvider.setPublishableKey('sk_test_KuVF8HocJm8tvSSpdV0dAOvj');
})
.config(function($facebookProvider){
    $facebookProvider.init({
        appId : '767874639960088',
        status : true,
        cookie : true,
        xfbml : true
        /*...*/
      });
});
// in scripts/app.js
window.onload = function() {
    // When the document is ready
    angular.element(document).ready(function() {
        // Bootstrap the oauth2 library
        gapi.client.load('oauth2', 'v2', function() {
            // Finally, bootstrap our angular app
            angular.bootstrap(document, ['myApp']);
        });
    });
}