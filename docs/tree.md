# AST Analysis Tree

```
Client Behavior
-- Events
-- -- addEventListener
-- -- onmessage
-- -- postMessage
-- -- onhashchange
-- eval
-- document.domain
-- -- Assignment
-- -- Read
-- window.open
-- innerHTML
-- fetch
-- URLSearchParams
-- Location
-- -- Assignment
-- -- -- [property-*]
-- -- Read
-- -- -- [property-*]
-- window.name
-- -- Assignment
-- -- Read
-- Storage
-- -- Cookie
-- -- -- Assignment
-- -- -- Read
-- -- localStorage
-- -- -- [property-*]
-- -- sessionStorage
-- -- -- [property-*]


Data
-- Paths
-- -- Paths
-- -- API
-- -- URL Paths
-- -- Query
-- -- Fragment
-- Hostname
-- Extensions
-- -- [extension-*]
-- MIME Type
-- Regex
-- -- Match
-- Secrets
-- -- [secret-type-*]
-- GraphQL
-- -- Query
-- -- Mutation
-- -- Other

Frameworks
-- React
-- -- dangerouslySetInnerHTML

Object Schemas
-- Fetch Options
```
