# Demo payment intents

Pre-created payment requests on Sui Testnet, for testing the UI against real
on-chain data and for the live demo.

Generated 3 September 2026 against package
`0xac4bbcadef19c4687a75bda3afa31e069473e8824d43d771f7c5c36fee1dd445`.
All amounts are USDC (6 decimals). MYR figures are stored on chain as integer sen,
so RM12.50 is `1250`.

> **Paying an intent marks it paid permanently.** A second attempt is rejected with
> `EIntentAlreadyPaid` (code 4) — that is the replay defence working, not a broken
> fixture. There are 20 payable requests per merchant so you can afford to spend them.

**60 payable** (expire 30 September 2026) · **3 deliberately expired** · 63 total.

---

## Kopitiam Seri Damai

Credential `0x73ffe36c370cd0e768e85f59e3c53eba557a3ccc123992d8062f2cbcc063d68f`  
Payout `0xc3eb96f569be60172e576300218274998ad23a113357055a947942247da63309`

### Payable — 20 requests, all expiring 30 Sep 2026 23:59

| Ref | Item | MYR | USDC | Payment intent |
| --- | --- | ---: | ---: | --- |
| KOPI-001 | Nasi lemak set | 5.00 | 1.063830 | `0x8eae65f9f3f398d5d109336309a7768e5018f4ea474e891614ee594eba40e042` |
| KOPI-002 | Teh tarik | 7.50 | 1.595745 | `0x16c7bbfbbe4478daba1963f3b35479e721212df807da90c41d17b62ae793763c` |
| KOPI-003 | Roti canai plus dhal | 9.90 | 2.106383 | `0x4960f5c929c8e47f18b067e5cd8ee9dbb3acee7d2aaaa785a461148ae3b3da52` |
| KOPI-004 | Mee goreng mamak | 12.00 | 2.553191 | `0x9ce02e50b282d6bf8e852cb311557e7a1f23f5821a18293c0b7f6e2c82f6aa0a` |
| KOPI-005 | Kopi O kosong | 14.50 | 3.085106 | `0xf6c183727e0d6e2de9d61d1682a0d9f1809bd1eb2e11ffeadadbf7c69f0b7a58` |
| KOPI-006 | Nasi goreng kampung | 16.80 | 3.574468 | `0xbb0a5371489ab3b485592280a983173c61527e4f521329f52698bbcac0477e49` |
| KOPI-007 | Roti telur | 18.00 | 3.829787 | `0xda33f7ff7aa9b0aa4a9204ca0c21bd248956aa43a9b290a8ad72990c4ccb6480` |
| KOPI-008 | Milo ais | 21.50 | 4.574468 | `0xa3a7271c34d2a0adb88da52ea2ee6a79cff022541e9ca254fc941aff886ed21f` |
| KOPI-009 | Char kuey teow | 23.90 | 5.085106 | `0xcd6f1e747cad327ae7730852ce2afe47d282e28ebc7e3c15076a7dd38323554f` |
| KOPI-010 | Nasi lemak ayam rendang | 25.00 | 5.319149 | `0xc12884f9fc5911269f38a1d7594014d41b62d4bacbd598e2e29620c192d37cc9` |
| KOPI-011 | Teh o ais limau | 27.50 | 5.851064 | `0x8f6aaea244794eac0428d24020b04fcd67f38de904032fcfe06ebd89888b1fe2` |
| KOPI-012 | Maggi goreng | 29.90 | 6.361702 | `0xc4bb1823e2bc5396a92d96e3fa2c5a13e04fec5dec5cd0ac4791ea7e5b5dcc9c` |
| KOPI-013 | Roti bom | 32.00 | 6.808511 | `0x6a498e7a737f947bec9a808b3be253a628562b4a2365d1bbe93b082a0590e1b8` |
| KOPI-014 | Nasi campur | 34.50 | 7.340426 | `0xe9853583d51019b333ff6627d3d4e863bd369cbb5d71a93f2f64052700cc2a54` |
| KOPI-015 | Cendol | 36.80 | 7.829787 | `0xc1412e37f2327e6b81cb7dfbbc58155d248958b96270085832916851b411f3e9` |
| KOPI-016 | Mee rebus | 39.00 | 8.297872 | `0xfc7466801fa6bddffb7a741be1c47336cb70cf104b2986249071f792b7f2830e` |
| KOPI-017 | Kuih muih platter | 41.50 | 8.829787 | `0xb40b09c23d0a9b5f8d4494c46c18159b30071f23d777d1f78a4fb9271d7b5f08` |
| KOPI-018 | Sup tulang | 43.90 | 9.340426 | `0x8f75176e3275cff0e28f5f26ad9915d725101a6c2ed5c1b358c691091ccb49a4` |
| KOPI-019 | Ayam goreng berempah | 46.00 | 9.787234 | `0xc3edd2f40309314bb16339f1d48a1d30403a861a18f930f2e51b7f2706356d9f` |
| KOPI-020 | Set sarapan lengkap | 49.90 | 10.617021 | `0x35fde8b5bb4cc78d2e7346e3e358398b4331c92db30fda7360ded03280b57e0a` |

### Expired — for demonstrating `EIntentExpired` (code 3)

Created with a five-minute window on 3 September and permanently expired since
04 Sep 2026 12:13. Paying it aborts with code 3.

| Ref | Item | MYR | Payment intent |
| --- | --- | ---: | --- |
| KOPI-EXPIRED | Expiry demonstration | 15.00 | `0x8fdf12428bfbfb0264ed283b62f310b5361503d501cc8bc30271f4d3ebeff435` |

---

## Campus Café

Credential `0xe0b13c411e139c254e8752f2bd4084d20f2767a31cca3cdeff47ad2175d234b3`  
Payout `0xa36de3707dd774f008d2e3639f310a11058201390fc2d3031c11d5215b5002dd`

### Payable — 20 requests, all expiring 30 Sep 2026 23:59

| Ref | Item | MYR | USDC | Payment intent |
| --- | --- | ---: | ---: | --- |
| CAFE-001 | Iced americano | 5.00 | 1.063830 | `0x3e325e9e2038bb356362d0324db7e05f0463f5a799d3a82f464e77c0dcffa334` |
| CAFE-002 | Flat white | 7.50 | 1.595745 | `0x9446fceadd08c806dea046b5173070a80468d5b4fc6c42cab322d8f10a039d0c` |
| CAFE-003 | Butter croissant | 9.90 | 2.106383 | `0xbce4666023472dbe29967166f6db04551e18af5a68707ef901fd42afc0c9d7e3` |
| CAFE-004 | Cold brew | 12.00 | 2.553191 | `0xd621e33c2e64a2786a7769824e41a139c22fe200b5092d7b2d9a626538d2f106` |
| CAFE-005 | Cappuccino | 14.50 | 3.085106 | `0x7044473156ee0c677674c94531ed73c7ae30cd6ed67da328b9ca97e4d7c91f80` |
| CAFE-006 | Matcha latte | 16.80 | 3.574468 | `0x31fdbbc3f35a618ed734ccc5b895f0b90ae36101a6a537d93b33d7b0159b136b` |
| CAFE-007 | Blueberry muffin | 18.00 | 3.829787 | `0x697346c6ba445fcbc5e87df0a7accbe205bb5e54fcbe6cdd6e39c3c7a22d99dc` |
| CAFE-008 | Espresso doppio | 21.50 | 4.574468 | `0xe4b63b9b2e32887343c792a7f64d76f6e67036fe4ca987465ca6bd37978da042` |
| CAFE-009 | Chai latte | 23.90 | 5.085106 | `0x1fc42e1042f2a2af925ce5113bd1642d205fdf79ddc0703d1e3138621f9988e9` |
| CAFE-010 | Almond biscotti | 25.00 | 5.319149 | `0x8d1a69dba02edcffaa735ee666b9be588552e87f36db24b1e280a37c6547700e` |
| CAFE-011 | Iced mocha | 27.50 | 5.851064 | `0x33cb1f946a66e4d9cf1989c7bf5072f922924d9587672c78040c00d261ab40c8` |
| CAFE-012 | Banana bread slice | 29.90 | 6.361702 | `0x7e6d803b70c5d1e8eac1e5733f92017a9d7ae813fddf99e0248b5a5bfe1ca1dd` |
| CAFE-013 | Piccolo latte | 32.00 | 6.808511 | `0xc00bd068ff3923793e1cc4d457249e5ea3969915ac15c7f6866cd1a98db8fce6` |
| CAFE-014 | Hot chocolate | 34.50 | 7.340426 | `0xc6a83556547963a844b4302e87472f53a51ffcbcbf661e5641ef73175adae445` |
| CAFE-015 | Cheese danish | 36.80 | 7.829787 | `0xac2349c0eb82c15e92479ba0567655e6550b22c232dc478484336a774e4e39b8` |
| CAFE-016 | Long black | 39.00 | 8.297872 | `0xa23218305aabb8a29f3f0804f42da4bc3b5f3edde93a7607fc0c8e4afd6c77d7` |
| CAFE-017 | Caramel macchiato | 41.50 | 8.829787 | `0x68fda8dc0c68730f35491b64146bf33b8164eeb58e9f7a142e8ef287e066685f` |
| CAFE-018 | Chicken pesto panini | 43.90 | 9.340426 | `0x41fce7adecee2fcf6e20fcd30c8f28ac13f09bf87580e58cc21f026695c7fd44` |
| CAFE-019 | Earl grey pot | 46.00 | 9.787234 | `0x312f279998b2be1bbadd1db46329d07947992214ef016a052f9f7763c34918fe` |
| CAFE-020 | Study set combo | 49.90 | 10.617021 | `0x2395d21a915e299d0f65483cfb129804a78c68da3dbd7c4892b9364a1bd5a9fe` |

### Expired — for demonstrating `EIntentExpired` (code 3)

Created with a five-minute window on 3 September and permanently expired since
04 Sep 2026 12:13. Paying it aborts with code 3.

| Ref | Item | MYR | Payment intent |
| --- | --- | ---: | --- |
| CAFE-EXPIRED | Expiry demonstration | 15.00 | `0xd174086208bccb8f8302ff6f75317a24d3dcc9324119209abc49564c4a49e798` |

---

## Olive's Restaurant

Credential `0x6cabaa253d1993b632540045c8701971a0902eaa965735e4aec11ccf5791b53d`  
Payout `0x540d9f6639b70cfa50015feb56e6f13db5a7827f7e50eb38acbd807c54eb0c65`

### Payable — 20 requests, all expiring 30 Sep 2026 23:59

| Ref | Item | MYR | USDC | Payment intent |
| --- | --- | ---: | ---: | --- |
| OLIV-001 | Garlic bread | 5.00 | 1.063830 | `0x9718e8162031d3a3970c7ddaa38e2a31f69079aa5165ee5ac3db9f1383c7784c` |
| OLIV-002 | Caesar salad | 7.50 | 1.595745 | `0x7003f99fde528277d99a82834ab924e4ca085405744a5cbb3cede7fee1572978` |
| OLIV-003 | Margherita pizza | 9.90 | 2.106383 | `0xeb99ae21cfc55fc5dcefb625a01e49062444d8f2c889ed57cc10b0732c626557` |
| OLIV-004 | Carbonara | 12.00 | 2.553191 | `0xb2eaf6b6a185953ba0d4d335bfbfb5726bcb5dc4cb9c748a2c6e2b600ed0b8be` |
| OLIV-005 | Minestrone soup | 14.50 | 3.085106 | `0x61280801db4e910edd5fdecdc4ba602116ff6cb0dd77ab2a7832cc564302ff2f` |
| OLIV-006 | Bruschetta plate | 16.80 | 3.574468 | `0x08f72b19d3861644da33a1a4c78d352d67b12f57806e5b5447f67f02ca3512ed` |
| OLIV-007 | Aglio olio | 18.00 | 3.829787 | `0x0de57271ad198619357a6fbc3856029d18b6567cbbff2d6cd0a60bea5eadfef5` |
| OLIV-008 | Lasagne al forno | 21.50 | 4.574468 | `0x6f8c08f0f499d8a89ef7a3b0fd3f32968c76c4a13d98d79124ca218587a30b73` |
| OLIV-009 | Grilled chicken pasta | 23.90 | 5.085106 | `0x95d7847471fcd74eb35140d64e5bb7f67793f86f4df1fc44221c7d530ced4d24` |
| OLIV-010 | Tiramisu | 25.00 | 5.319149 | `0x8be1767a967a0053c294eb5a80c05771e7a8261048e8022e57bd21a634ca7927` |
| OLIV-011 | Mushroom risotto | 27.50 | 5.851064 | `0x5c25772d44b1eba5ea8a971cf6d02bcb9f9bae0d1dfbbee4c068ff225744991a` |
| OLIV-012 | Focaccia basket | 29.90 | 6.361702 | `0x2255d15b14fd58043347fc881dee9f5265ddd1ec18bc3d4e9c0dd266c7603dec` |
| OLIV-013 | Seafood marinara | 32.00 | 6.808511 | `0x33f7cfeeb93366cf802a8afa8f6c516c9b4c5c3baf3e7d74240077b053d0ec9f` |
| OLIV-014 | Panna cotta | 34.50 | 7.340426 | `0xc300d49e073cbe42369f0eacfe96dc76bafa1d09f2846113df4218fbc3490d02` |
| OLIV-015 | Beef ragu | 36.80 | 7.829787 | `0x4e6d8832017d5110896910939c14c561d94c806404ab1e25f61b8c8c30baeaf7` |
| OLIV-016 | Caprese salad | 39.00 | 8.297872 | `0x8b67763e013b880cee6b7fe07a0e26c4949d8fb077c4a5b7dc8af143075666a6` |
| OLIV-017 | Pesto gnocchi | 41.50 | 8.829787 | `0x2b5b81e728434800b3844f1b73044ae158090682d2e67b6b8d59e9b26b8167f3` |
| OLIV-018 | Calzone | 43.90 | 9.340426 | `0x9b98c1f710506f77a644a83b153bc803ba4e575d6e12aa09e8ad872bc64407da` |
| OLIV-019 | Affogato | 46.00 | 9.787234 | `0xb0189f57ed7e9089e88b8439582af26a22709224ce7454eb83ca6f796c6d04c7` |
| OLIV-020 | Tasting plate | 49.90 | 10.617021 | `0x1fd9c3e55ee8df03b67fa1ef97d2508d3a88af9d710e838743b6f0af0c0b34c8` |

### Expired — for demonstrating `EIntentExpired` (code 3)

Created with a five-minute window on 3 September and permanently expired since
04 Sep 2026 12:13. Paying it aborts with code 3.

| Ref | Item | MYR | Payment intent |
| --- | --- | ---: | --- |
| OLIV-EXPIRED | Expiry demonstration | 15.00 | `0x122ac28631b9c5c3baeedad00a7a6974832b172ea410ab5ca4768c8fdcec4a55` |

---

## Using one

Read a request:

```bash
sui client object <payment-intent-id>
```

Pay it. The split must be in the same PTB, because Payment Kit rejects any coin
whose value is not exactly the amount:

```bash
sui client ptb \
  --split-coins @<your-usdc-coin> "[<amount in USDC units>]" --assign split \
  --move-call 0xac4bbcadef19c4687a75bda3afa31e069473e8824d43d771f7c5c36fee1dd445::payments::pay_payment_intent \
    "<0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC>" \
    @<merchant-credential> @<payment-intent> \
    @0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691 split.0 @0x6 \
  --gas-budget 300000000
```

Argument order is credential, intent, registry, coin, clock. Swap in an expired
request and the same command aborts with code 3 instead of succeeding.

Run `npm run verify:chain` to confirm the deployment is healthy before demoing.
