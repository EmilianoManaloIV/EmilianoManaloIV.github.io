# ADR 0020: Social announcements after deployment

- **Status:** accepted (2026-11-25, task 0004)
- **Deciders:** the owner and the main session
- **Related:** ADR 0001, ADR 0005, task 0004

## Context
The owner wants to announce selected R&D articles across Instagram, LinkedIn and X. The website publishes from Discussions through GitHub Pages, and the owner wants to see a test case before merging. Instagram automatic publishing requires a professional account and feed images have format and size limits. [Meta image requirements](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media#image-specifications)

## Alternatives
Direct platform integrations would require three app and credential lifecycles. A feed polled by an external service would need its own delay and deduplication rules. Buffer offers the three channels through one API that Actions can call after deployment.

## Decision
Use the `share: social` label and a separate Actions workflow after the production Pages deploy. The build hands off plain title and summary text, the canonical article URL, a revision, and the selected image in a workflow artifact. Check the live article revision and opt-in before each submission. Copy an author-supplied JPEG under a digest-based name so an older job cannot use an image slot reused by a later deploy. The workflow defaults to a preview. After the owner enables it, it submits the three announcements through Buffer's GraphQL API using an Actions secret. [Buffer API](https://support.buffer.com/en-us/articles/using-buffers-api-GtIYIQilz5)

Record a claim for each Discussion number and channel in a dedicated status branch before sending. It includes the target channel ID, attempt time, article URL and revision. Acknowledged submissions retain their Buffer ID. A definitive rejection or an ambiguous outcome retains a record for manual recovery. The branch stores publishing status and no credentials.

## Rationale
Sharing after a successful Pages deploy gives the announcement a live destination. A persistent claim gives the workflow a safe stopping point when Buffer may have accepted a request before the connection failed. GitHub's Contents API checks the file revision when updating the branch. [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

## Consequences
The site's deploy can succeed independently of Buffer. The owner needs a Buffer account, a professional Instagram account, and an R&D link in the Instagram bio. The workflow records acceptance by Buffer. Actual delivery is visible in Buffer. The owner manages existing social posts on the platforms themselves.

Watch for pending submissions after timeouts. Check Buffer before clearing a claim so a retry cannot duplicate a post.

## Amendment (2026-11-25, task 0005)

The social formatter bounds the finished text using Buffer's API limits and reserves space for the link
or bio prompt. It accounts for LinkedIn's URL weight and Instagram's newline weight. For X it normalizes
Unicode before counting with conservative character and URL weights. A social image
must satisfy the JPEG size and aspect ratio requirements and be at least 320 pixels wide. If a selected
image is unavailable on the live site, the publisher checks the branded card before preparing Instagram's
request. These decisions apply to the announcements and preserve the rendered website article. [Buffer API text limits](https://developers.buffer.com/guides/character-limits.html) · [X character counting](https://docs.x.com/fundamentals/counting-characters) · [Instagram image specifications](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media#image-specifications)

## Amendment (2026-11-26, task 0006)

The build uses the author's rendered text, including paragraph breaks, in the social artifact. The
website cards use their short excerpt. The publisher fits the article text to each channel's limit,
including X, while preserving the article link or Instagram bio prompt. For X the formatter uses the
weighted Unicode ranges from twitter-text and counts complete emoji and URLs as units. A checked-in
IANA root-zone snapshot helps distinguish links from dotted text such as code identifiers. The snapshot
is local build data. [X character counting](https://docs.x.com/fundamentals/counting-characters) · [twitter-text v3 weights](https://github.com/twitter/twitter-text/blob/master/config/v3.json) · [IANA root-zone data](https://data.iana.org/TLD/tlds-alpha-by-domain.txt)

## Amendment (2026-11-26, task 0008)

LinkedIn and X can each attach the first compatible JPEG or PNG from the article. The build uses their
separate limits and writes digest-named copies, preserving alt text. The manifest keeps optional images
for these channels alongside the existing Instagram image. The publisher checks the live asset before
attaching it and keeps the article link in the text. [Buffer media API](https://developers.buffer.com/guides/hosting-media.html) · [Buffer image limits](https://support.buffer.com/articles/ideal-image-sizes-and-formats-for-your-buffer-posts-JxHNGZFvf9) · [LinkedIn Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-09)
