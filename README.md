# AutoSetupLongTapFreeze
## Warning

Since I started work on this script my life has gotten a lot busier and even though I still like working on this kind of stuff, I can't really justify spending any time on it. In other words: the script needs a new maintainer... If you're up to it, just make an issue for it. Pull requests are also always welcome of course!

## Development workflow

I have a seperate desktop dedicated to script development. On this desktop is a panel with a few items in it that are usually frozen on my device for testing the sync capabilities. This panel lives somewhere of to the side of the desktop where I don't see it often and i call it my template testing container. I wrote another very basic script which copies this template container to a more directly visible place on the desktop and in this container i run the script to test it. This "Reset" script also removes the old container before copying over the new one.
Aside from that i use a custom view log: http://www.lightninglauncher.com/wiki/doku.php?id=script_customviewlog to write debug information to a custom text view above the testing container.
When i don't have access to my laptop, i edit scripts with quoda: https://play.google.com/store/apps/details?id=com.henrythompson.quoda&hl=en and use this script to automatically import the external file: http://www.lightninglauncher.com/wiki/doku.php?id=script_external_editor_script_importer
When I do have access to my laptop i edit with notepad++, but i might switch to atom soon, and then sync the file with my phone with winscp (https://winscp.net/eng/download.php) and sshdroid (https://play.google.com/store/apps/details?id=berserker.android.apps.sshdroid&hl=en) and then still sync the external file with the automatic script importer script.