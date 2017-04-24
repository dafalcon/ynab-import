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
    import_new_transactions = casper.cli.options["import"];

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

  // need approval or categorization:
  // .accounts-notification button
  // $(".accounts-notification button").text();
  // "432 transactions"
  // parseInt($(".accounts-notification button").text().match(/([0-9]+)/)) || 0;

  // import button: .accounts-toolbar-import-transactions
  // text:
  // "         Import
  //          (13)
  //        "
  // parseInt($(".accounts-toolbar-import-transactions").text().match(/([0-9]+)/)) || 0;

  var accountsSelector = '.nav-account .nav-account-row';
  var new_transactions = 0;
  var transactions_to_review = 0;
  casper.waitForSelector(accountsSelector, function() {
    var returned_accounts = this.evaluate(function(import_new_transactions) {
      var accounts = [];
      $(".nav-account .nav-account-row").each(function() {
        this.click();
        accounts.push({
          name: $.trim($(this).find('.nav-account-name').text()),
          pending: parseInt($(".accounts-notification button").text().match(/([0-9]+)/)) || 0,
          imported: parseInt($(".accounts-toolbar-import-transactions").text().match(/([0-9]+)/)) || 0});
      });
      if (import_new_transactions) {
        $(".accounts-toolbar-import-transactions").click();
      }
      return accounts;
    }, import_new_transactions);
    print_account_summary(casper, returned_accounts, import_new_transactions);
  });
}

casper.run();



// Next steps:
// - Click the import button
// - Print a nice report, remove other junk from it so only the account info I want to see is printed.
// - Email the report to jen and i
// 
