/**
 * @class BookController
 * @classdesc
 * @ngInject
 */
function BookController($scope, $q, BookService, ConfigLoader, DialogService, SecurityService) {

  var ctrl = this;

  ctrl.books = [];
  ctrl.securities = [];
  ctrl.accounts = ConfigLoader.getAllAccounts();

  /**
   *
   */
  ctrl.init = function(){
      $scope.$on('chainblock-ch-'+ BookService.getChannelID(), ctrl.reload);
      ctrl.reload();
  }

  /**
   *
   */
  ctrl.reload = function(){
    ctrl.invokeInProgress = true;

    return $q.all([

        SecurityService.list(SecurityService.STATUS_ACTIVE)
          .then(function(list){
            ctrl.securities = list;
          }),

        BookService.list()
          .then(function(list){
            ctrl.books = list;
          })

      ])
      .finally(function(){
        ctrl.invokeInProgress = false;
      });

  }



  /**
   * @param {Instruction} instruction
   */
  ctrl.showHistory = function(book){
    return BookService.history(book)
      .then(function(result){
        var scope = {history: result};
        return DialogService.dialog('book-history.html', scope);
      });
  }

  ctrl.addBook = function(book){
    ctrl.invokeInProgress = true;
    return BookService.put(book)
      .then(function(){
        $scope.book = null;
        $scope.bookForm.$setPristine();
      })
      .finally(function(){
        ctrl.invokeInProgress = false;
      });
  }



  ctrl.init();
}

angular.module('nsd.controller.book', ['nsd.service.book'])
.controller('BookController', BookController);