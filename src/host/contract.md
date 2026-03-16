# host contract

## Inputs

- `CompositeUiDescriptor` from core types

## Outputs

- `CompositeUiHost` interface for host implementations
- `HostConfig` for host configuration

## Invariants

- Type-only module: no runtime code, no side effects.
- Depends only on core types (no circular deps to sdk or other layers).
- Host implementations are external — this module only defines the contract.
