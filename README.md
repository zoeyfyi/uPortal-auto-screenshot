# uPortal auto screenshot

Screenshots each portlet in your uPortal instance. Usefull for collecting an initial set of images for the marketplace portlet or a primitive form of screenshot testing.

## Usage

```
Usage: uportal-auto-screenshot.js [options] [command]

  Commands:
    capture  Capture screenshots of portlets
    help     Display help
    version  Display version
  Options:
    -a, --auth [value]              Type of authentication: local|manual|cas (defaults to "local")
    -h, --help                      Output usage information
    -l, --loginUrl [value]          URL of cas (for cas authentication) (defaults to "http://localhost:8080/cas/login?service=http://localhost:8080/uPortal/Login")
    -O, --outDir [value]            Directory to save screenshots too (created if it does not exist) (defaults to "screenshots")
    -o, --overwrite                 Overwrites existing screenshots (disabled by default)
    -p, --password [value]          Password of local uPortal user (defaults to "admin")
    -P, --passwordSelector [value]  Selector for the password textbox (for cas authentication) (defaults to "#password")
    -s, --submitSelector [value]    Selector for the submit button (for cas authentication) (defaults to "input[type='submit']")
    -u, --url [value]               URL of uPortal instance (defaults to "http://localhost:8080")
    -U, --username [value]          Username of local uPortal user (defaults to "admin")
    -U, --usernameSelector [value]  Selector for the username textbox (for cas authentication) (defaults to "#username")
    -v, --version                   Output the version number
```

## Authentication Types

| Authentication Type | Notes |
| --- | --- |
| `manual` | Easiest way to authenticate, launches a browser window to login manually. |
| `local` | Local uPortal accounts, just provide a `username` and `password`. |
| `cas` | Log in via a central authentication system. You need a `loginUrl` (url users are sent to when they press login), `username` and `password`. In most cases you will also need to specify the selectors for the login form with `usernameSelector`, `passwordSelector`, `submitSelector`. |

The default values for these flags allow you to try each authentication type without specifying all the other flags with a fresh instance of [uPortal-start](https://github.com/Jasig/uPortal-start).
