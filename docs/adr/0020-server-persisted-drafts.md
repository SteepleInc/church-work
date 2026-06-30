# Server-persisted drafts

Drafts are first-class, server-persisted, user-private, Church-scoped composition records rather than local browser state. This lets Drafts appear consistently across devices, gives the sidebar and Drafts page a Zero-backed source of truth, and creates a shared model that Task Drafts can use now and Template Drafts can use later. We accept the extra data-model and mutator surface instead of copying Linear's hidden local-only composer draft layer, because Church Work's visible Drafts experience should be durable and synced once a User explicitly saves a Draft.
