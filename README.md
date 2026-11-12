# Shipyard Halloween Pet Photo Shoot: voting setup

About 5 minutes, one time.

## 1. Make the vote sheet
1. Go to sheets.new and name the sheet "Shipyard Pet Vote".
2. Open Extensions > Apps Script.
3. Delete what's in Code.gs and paste in all of **backend/Code.gs**. Save.
4. In the dropdown at the top, pick `setup` and click **Run**. Approve access. If you see "Google hasn't verified this app", click Advanced, then Go to project. It's your own script.
5. Back in the sheet you'll see 4 new tabs: **Dogs, Votes, Results, Settings**.

## 2. Put it online
1. In Apps Script: **Deploy > New deployment**, then click the gear and pick **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. Click Deploy and copy the **Web app URL**. It ends in `/exec`.
4. Open **index.html** and paste that URL between the quotes on this line near the top:
   `const SCRIPT_URL = "";`
5. Put index.html on your website. That page is the link you send out.

## 3. Add the pets (any time, no code)
In the **Dogs** tab, add one row per pet:
- **Name**: e.g. Biscuit
- **Caption**: optional, e.g. "Biscuit as a lobster"
- **Photo URL**: a share link to the photo. Dropbox and Google Drive links both work as long as the file is shared as "anyone with the link".
- **Show**: ticked. Untick to hide a pet without deleting it.

Delete the "Example Pup" row. Changes show up the next time someone opens the page.

## Running the contest
- **Results** tab: live leaderboard. 1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt. Ties go to whoever has more 1st place votes.
- **Votes** tab: every ballot with name and email. Delete a row to throw out a bad vote.
- **Close voting**: Settings tab, untick "Voting open".
- Don't rename a pet after votes come in. Old votes stay under the old name.
- If you edit Code.gs later, use Deploy > Manage deployments > Edit > New version so the same link keeps working.
