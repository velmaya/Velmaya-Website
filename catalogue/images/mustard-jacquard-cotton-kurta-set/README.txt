Expected image filenames for: Mustard Jacquard Cotton Kurta Set
(slug: mustard-jacquard-cotton-kurta-set — this folder name must always
match the slug exactly, since scripts/import-images.mjs looks up images
at catalogue/images/{slug}/{filename})

01-front.jpg
02-back.jpg
03-side.jpg
04-detail.jpg
05-fabric.jpg
06-lifestyle.jpg

This is only a guide. Do not create image files from this list —
place the real product photos here when they're ready.

Note for whoever stages the real images: the project's automated
image importer (scripts/import-images.mjs, see catalogue/README.md)
currently expects .webp files (not .jpg) named
NN-shot_type.webp, where shot_type is one of:
front, back, side, fabric_closeup, detail_closeup, lifestyle
— e.g. 04-detail_closeup.webp, 05-fabric_closeup.webp, not
04-detail.jpg / 05-fabric.jpg as listed above. Convert/rename to that
convention before running the importer, or the images will be
rejected by verification.

Currently staged in this folder: 01.jpg, 02.jpg — these are
placeholders/drafts and do NOT yet match the required convention
above. They also don't match the exact filenames listed in this
product's image_filenames CSV column (01.jpg;02.jpg), which was set
to match what's actually here for now. Both will need to be renamed
to the NN-shot_type.webp convention (and the CSV cell updated to
match) before a real image import can succeed.
