# my-hyperevm-subgraph

## Deployment Steps

### Install Goldsky CLI
```bash
npm install -g @goldsky/cli
```

### Login to Goldsky
```bash
goldsky login
```

### Install dependencies
```bash
cd aave-v3-subgraph
npm install
```

### Generate code from schema
```bash
npm run codegen
```

### Build the subgraph
```bash
npm run build
```

### Deploy to Goldsky
```bash
goldsky subgraph deploy aave-v3-hyperevm/v1.0.8 --path .
```

### Follow the logs
```
goldsky subgraph log aave-v3-hyperevm/v1.0.8 --levels=warn
```

supply()
- asset : 0xdf1b2c6007d810facbd84686c6e27ce03c2c4056
- amount : 10
- onBehalfOf : 0xd6C09F431129BF459Ed1D53e3B00190C4BfdB987
- referralCode : 0

### Pourquoi mes actions (supply, borrow...) ne fonctionnaient pas ? 
- Il faut passer par PoolProxy et non PoolInstance
-> On utilise ce pattern avec proxy pour l’upgradabilité. En gros, tu as l’instance d’un côté (avec la logique), et le proxy de l’autre (avec les data). On ne s’adresse qu’au proxy.
C’est un peu chiant mais c'est assez courant, ça permet à l’admin (multisig) de venir ajouter une feature, ou corriger un bug 🐛  : il peut modifier l’instance sans toucher au proxy (donc sans toucher à ce qu’ont fait les gens, etc)

- Ensuite il faut approve et minter le mockUSDC
- Il faut donner l'allowance au PoolProxy
MockUSDC.approve(0xf4438C3554d0360ECDe4358232821354e71C59e9, 1000 * 1e18);

- Après on peut vérifier que l'approve s'est bien passé avec un allowance 
MockUSDC.allowance(0xd6C09F431129BF459Ed1D53e3B00190C4BfdB987, 0xf4438C3554d0360ECDe4358232821354e71C59e9)

- Ton PoolProxy appelle transferFrom(owner, PoolProxy, amount).

Pour que ça marche :

Ton balanceOf(owner) doit être assez grand ✅

Ton allowance(owner, PoolProxy) doit être ≥ amount

Sinon transferFrom revert avec "Insufficient allowance"…
Mais dans ton MockUSDC, comme le require(balanceOf[from] >= amount) est écrit avant, l’erreur affichée reste "Insufficient balance" même si c’est l’allowance qui bloque → c’est trompeur ⚠️.