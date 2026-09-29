# Permissions

| Capability | Owner | Administrator | Booker | Talent Manager | Creative | Accounting | Talent | Read Only |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| View published talent | Yes | Yes | Yes | Yes | Yes | Limited | Own | Yes |
| Create/edit talent core | Yes | Yes | Limited | Yes | No | No | Limited | No |
| Publish/unpublish | Yes | Yes | Limited | Yes | No | No | No | No |
| Manage boards | Yes | Yes | No | Yes | No | No | No | No |
| Manage public media | Yes | Yes | Limited | Yes | Yes | No | Own uploads later | No |
| View private details | Yes | Limited | No | No | No | Yes | No | No |
| View banking/legal/medical | Explicit grant | Explicit grant | No | No | No | Finance only | No | No |

The final matrix must be reviewed against actual business policy before staging. UI hiding is not the security boundary; RLS policies and server-side validation are.

