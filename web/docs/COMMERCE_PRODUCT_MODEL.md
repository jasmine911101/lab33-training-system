# LAB33 Commerce Product Model

Commerce Sprint 1.1 defines **Training Product** as the sellable unit and **Block** as reusable training content.

Payments, sales records, coupons, subscriptions, and marketplace settlement are intentionally out of scope for this sprint.

## Product vs Product Version

`training_products` is the stable product identity:

- author coach
- current storefront metadata
- lifecycle status: `draft`, `published`, `archived`
- active flag
- published / unpublished / archived timestamps

`training_product_versions` is the immutable content snapshot used for publishing:

- `version_number`
- version status: `draft`, `published`, `retired`
- snapshot name / description / price / currency
- publish / retire timestamps

A product can have many versions, but only one version can be `published` at a time.

## Product Blocks

`training_product_blocks` belongs to a product version, not directly to a product:

```text
training_products
  -> training_product_versions
    -> training_product_blocks
      -> blocks
```

This preserves historical product contents after publication. Future sales should reference `product_version_id` so a purchased product always points to the exact content the athlete bought.

## Product Lifecycle

Product status:

- `draft`: not currently published for sale.
- `published`: has a published version and can be shown by future store flows.
- `archived`: soft archived, hidden from management actions, historical versions retained.

## Version Lifecycle

Version status:

- `draft`: editable.
- `published`: read-only and currently active for the product.
- `retired`: historical read-only version.

Published versions are immutable. To edit published product content, create a new draft version from the published version.

## Publish Behavior

Publishing a draft version is transactional through `publish_product_version`:

1. Validate coach authorization.
2. Validate draft status.
3. Validate name, price, currency, and at least one block.
4. Retire any existing published version.
5. Mark the draft version as published.
6. Update product status and storefront metadata.

## Unpublish Behavior

Unpublish sets the product back to `draft`, sets `is_active = false`, and records `unpublished_at`.

The published version remains `published` as a historical content reference. Future store/sales work should decide whether unpublished products are hidden by product status rather than destroying version history.

## Archive Behavior

Archive is a soft archive:

- `training_products.status = archived`
- `is_active = false`
- `archived_at` and `unpublished_at` are set
- draft versions are retired
- published/retired versions and block mappings are retained

No product, version, or block mapping is physically deleted during archive.

## Why Published Versions Are Read-only

Sales, reporting, and athlete access must be able to answer: “What exactly did the athlete buy?”

If a published version were editable, historical sales could silently point to changed content. Version immutability prevents that data integrity problem.

## Future Sales Model

Future sales records should store at least:

- `product_id`
- `product_version_id`
- `athlete_id`
- `seller_coach_id`
- original price
- discount
- net amount
- payment status
- purchased_at

Leaderboards and analytics should use SQL aggregation over sales records, not denormalized counters.
