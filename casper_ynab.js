#!node_modules/casperjs/bin/casperjs

function print_usage(casper) {
  casper.echo("Usage: ./casper_ynab.js --username=USERNAME --password=PASSWORD [--import]");
}

function is_blank(string) {
  return null == string || 0 == string.length;
}

function print_account_summary(casper, accounts, import_new_transactions) {
  var total_pending = 0,
      total_imported = 0,
      import_str = ' to import';
  if (import_new_transactions) {
    import_str = ' imported';
  }
  casper.each(accounts, function(self, account) {
    casper.echo(account.name + ": " + account.pending + " pending, " + account.imported + import_str);
    total_pending += account.pending;
    total_imported += account.imported;
  });
  casper.echo("All accounts: " + total_pending + " pending, " + total_imported + import_str);
}

// client scripts have to be local
var casper = require('casper').create({
  clientScripts: ['jquery.min.js']
});

// Check command line arguments
var username = casper.cli.options["username"],
    password = casper.cli.options["password"],
    import_new_transactions = casper.cli.options["import"],
    account_names = [],
    account_details = [];

casper.on('remote.message', function(msg) {
  if (casper.options.verbose) {
    this.echo(msg);
  }
});

if (is_blank(username) || is_blank(password)) {
  print_usage(casper);
} else {
  casper.start('https://app.youneedabudget.com/');

  casper.then(function() {
    this.fillSelectors(".users-form", {
      "input.login-username": username,
      "input.login-password": password
    });
  });

  casper.thenClick(".button-primary");

  casper.then(function() {
    var accountsSelector = '.nav-account .nav-account-row';
    casper.waitForSelector(accountsSelector, function() {
      account_names = this.evaluate(function(accountsSelector) {
        var accounts = [];
        $(accountsSelector).each(function() {
          accounts.push($.trim($(this).find('.nav-account-name').text()));
        });
        return accounts;
      }, accountsSelector);
    });
  });

  casper.then(function() {
    casper.eachThen(account_names, function(obj) {
      account_details.push(casper.evaluate(function(account) {
        $("div.nav-account-name.user-data[title='" + account + "']").click();
        var data = {
          name: account,
          pending: parseInt($(".accounts-notification button").text().match(/([0-9]+)/)) || 0,
          imported: parseInt($(".accounts-toolbar-import-transactions").text().match(/([0-9]+)/)) || 0
        };
        return data;
      }, obj.data));

      // TODO: this is broken - it only imports transactions from one
      // account.  I think I need a waitFor call after it.  If you
      // click import when there are no transactions to import then it displays a message like this:

      //   <div id="ember8262" class="ember-view accounts-notification-item accounts-notification-no-transactions-imported" style="overflow: hidden; height: 24.9511px; padding-top: 5.70312px; margin-top: 0px; padding-bottom: 5.70312px; margin-bottom: 0px;">There are no transactions to import. </div>

      // But if there are transactions to import it doesn't display
      // anything specific to actually importing them.  My best idea
      // at this point is to write a waitFor function that evaluates
      // some javascript and returns true when the text of the import
      // button does not contain parenthesis.      
      casper.then(function() {
        if (import_new_transactions) {
          casper.evaluate(function() {
            $(".accounts-toolbar-import-transactions").click();
          });
        }
      });
    });
  });

  casper.then(function() {
    print_account_summary(casper, account_details, import_new_transactions);
  });

}

casper.run();



// Next steps:
// - Click the import button
// - Print a nice report, remove other junk from it so only the account info I want to see is printed.
// - Email the report to jen and i
// 
