#!node_modules/casperjs/bin/casperjs

function print_usage(casper) {
  casper.echo("Usage: ./casper_ynab.js --username=USERNAME --password=PASSWORD [--import] [--verbose] [--logLevel=LOGLEVEL]");
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
var casper = require('casper').create();

// Check command line arguments
var username = casper.cli.options["username"],
    password = casper.cli.options["password"],
    import_new_transactions = casper.cli.options["import"],
    verbose = casper.cli.options["verbose"],
    logLevel = casper.cli.options["logLevel"],
    account_names = [],
    account_details = [];

if (verbose) {
  casper.options.verbose = true;
}
if (logLevel) {
  casper.options.logLevel = logLevel;
}

// print browser console messages if we're running in verbose mode
casper.on('remote.message', function(msg) {
  if (casper.options.verbose) {
    this.echo(msg);
  }
});

// pull username and password from environment variables
var system = require('system');
var env = system.env;
if (is_blank(username)) {
  username = env.YNAB_USERNAME;
}
if (is_blank(password)) {
  password = env.YNAB_PASSWORD;
}

if (is_blank(username) || is_blank(password)) {
  print_usage(casper);
  phantom.exit(1);
} else {
  casper.start('https://app.youneedabudget.com/');

  // log in
  casper.then(function() {
    this.fillSelectors(".users-form", {
      "input.login-username": username,
      "input.login-password": password
    });
  });
  casper.thenClick(".button-primary");

  // get a list of accounts
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

  // iterate over all the accounts
  casper.then(function() {
    casper.eachThen(account_names, function(obj) {

      var account_name = obj.data;

      // click the account in the left hand nav
      casper.evaluate(function(account_name) {
        $("div.nav-account-name.user-data[title='" + account_name + "']").click();
      }, account_name);

      // wait for the display to load that account_name
      casper.then(function() {
        casper.waitFor(function() {
          return this.evaluate(function(account_name) {
            return $.trim($(".accounts-header-total-inner-label").text()) == account_name;
          }, account_name);
        });
      });

      // scrape some information about the account
      casper.then(function() {
        account_details.push(casper.evaluate(function(account_name) {
          var data = {
            name: account_name,
            pending: parseInt($(".accounts-notification button").text().match(/([0-9]+)/)) || 0,
            imported: parseInt($(".accounts-toolbar-import-transactions").text().match(/([0-9]+)/)) || 0
          };
          return data;
        }, account_name));
      });

      casper.then(function() {
        if (import_new_transactions) {
          // click the import button
          casper.evaluate(function() {
            $(".accounts-toolbar-import-transactions").click();
          });

          // wait for the import to complete.  the numeric value of
          // transactions to be imported clears immediately, but the
          // import itself happens asynchronously and you can't go to
          // the next account until it finishes.  this isn't a great
          // solution, but it works for now.
          casper.wait(3000);
        }
      });
    });
  });

  casper.then(function() {
    print_account_summary(casper, account_details, import_new_transactions);
  });

  casper.run();
}


