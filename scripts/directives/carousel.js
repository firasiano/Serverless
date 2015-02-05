angular.module('myApp.directives').directive('mycarousel', function() {
    return {
        restrict: 'EA',
        scope: {
            slides: '&',
            myInterval: '&'
        },
        templateUrl: "scripts/directives/views/carousel.html",
        replace: true,
        link: function(scope, ele, attrs) {
            scope.myInterval = attrs.myInterval || 50000;
            var slides = scope.slides = [];
            scope.addSlide = function() {
                var newWidth = 600 + slides.length + 1;
                slides.push({
                  image: 'http://placekitten.com/' + newWidth + '/300',
                  text: ['More','Extra','Lots of','Surplus'][slides.length % 4] + ' ' +
                  ['Cats', 'Kittys', 'Felines', 'Cutes'][slides.length % 4]
              });
            };
            for (var i=0; i<4; i++) {
                scope.addSlide();
            }
        }
    };
});