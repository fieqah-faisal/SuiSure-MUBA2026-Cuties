#[test_only]
module suisure::payments_tests {
    use std::ascii;
    use std::string;
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_scenario as ts;

    /// A stand-in for "some other coin an attacker happens to hold". Its only
    /// job is to be a different type from SUI while carrying the same value.
    public struct WORTHLESS has drop {}
    use payment_kit::payment_kit::{Self as kit, PaymentRegistry};
    use suisure::payments::{Self, AdminCap, MerchantCredential, PaymentIntent, SuiSureReceipt};

    const ADMIN: address = @0xAD;
    const PAYER: address = @0xFEE;
    const PAYOUT_A: address = @0xB0B;
    const PAYOUT_B: address = @0xCAFE;

    /// One SUI in MIST. Payment Kit rejects a coin whose value is not exactly
    /// the requested amount, so tests mint precisely this.
    const AMOUNT: u64 = 1_000_000_000;
    /// RM12.50 in integer sen.
    const AMOUNT_MYR: u64 = 1250;
    /// A UUIDv4 is exactly 36 characters, which is Payment Kit's limit.
    const NONCE: vector<u8> = b"11111111-2222-3333-4444-555555555555";
    const EXPIRY_MS: u64 = 10_000;

    // === helpers ===

    /// Publishes both modules into the scenario. `payment_kit`'s own test hook
    /// shares a real Namespace and a real PaymentRegistry, so these tests run
    /// against the actual cashier rather than a stub.
    fun begin(): ts::Scenario {
        let mut scenario = ts::begin(ADMIN);
        payments::init_for_testing(ts::ctx(&mut scenario));
        kit::init_for_testing(ts::ctx(&mut scenario));
        scenario
    }

    fun register(scenario: &mut ts::Scenario, name: vector<u8>, payout: address): ID {
        ts::next_tx(scenario, ADMIN);
        let cap = ts::take_from_sender<AdminCap>(scenario);
        payments::register_merchant(
            &cap,
            string::utf8(name),
            string::utf8(b"Food & Beverage"),
            payout,
            ts::ctx(scenario),
        );
        ts::return_to_sender(scenario, cap);
        ts::next_tx(scenario, ADMIN);
        ts::most_recent_id_shared<MerchantCredential>().extract()
    }

    fun new_clock(scenario: &mut ts::Scenario): Clock {
        clock::create_for_testing(ts::ctx(scenario))
    }

    /// Creates an intent against `credential_id` that expires at EXPIRY_MS.
    fun create_intent(scenario: &mut ts::Scenario, credential_id: ID, clock: &Clock) {
        ts::next_tx(scenario, ADMIN);
        let credential = ts::take_shared_by_id<MerchantCredential>(scenario, credential_id);
        payments::create_payment_intent<SUI>(
            &credential,
            AMOUNT,
            AMOUNT_MYR,
            ascii::string(NONCE),
            string::utf8(b"Nasi lemak set"),
            string::utf8(b"ORD-2891"),
            EXPIRY_MS,
            clock,
            ts::ctx(scenario),
        );
        ts::return_shared(credential);
    }

    // === tests ===

    #[test]
    fun register_merchant_shares_an_active_credential() {
        let mut scenario = ts::begin(ADMIN);
        payments::init_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            payments::register_merchant(
                &cap,
                string::utf8(b"Kopitiam Seri Damai"),
                string::utf8(b"Food & Beverage"),
                PAYOUT_A,
                ts::ctx(&mut scenario),
            );
            ts::return_to_sender(&scenario, cap);
        };

        // The credential must be readable by someone who is not the admin,
        // which is the whole point of sharing it.
        ts::next_tx(&mut scenario, ADMIN);
        {
            let credential = ts::take_shared<MerchantCredential>(&scenario);
            assert!(payments::name(&credential) == string::utf8(b"Kopitiam Seri Damai"), 0);
            assert!(payments::category(&credential) == string::utf8(b"Food & Beverage"), 1);
            assert!(payments::payout(&credential) == PAYOUT_A, 2);
            assert!(payments::is_active(&credential), 3);
            ts::return_shared(credential);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = payments::EMerchantInactive)]
    fun pay_fails_when_merchant_is_inactive() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        create_intent(&mut scenario, credential_id, &clock);

        // Switch the merchant off after the intent already exists.
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            payments::set_merchant_active(&cap, &mut credential, false);
            assert!(!payments::is_active(&credential), 0);
            ts::return_shared(credential);
            ts::return_to_sender(&scenario, cap);
        };

        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = payments::ECredentialMismatch)]
    fun pay_fails_with_a_different_merchants_credential() {
        let mut scenario = begin();
        let credential_a = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let credential_b = register(&mut scenario, b"Campus Cafe", PAYOUT_B);
        let mut clock = new_clock(&mut scenario);

        // Intent belongs to merchant A.
        create_intent(&mut scenario, credential_a, &clock);

        // Paying it while presenting merchant B's credential would redirect the
        // payout, so it must abort.
        ts::next_tx(&mut scenario, PAYER);
        {
            let credential = ts::take_shared_by_id<MerchantCredential>(&scenario, credential_b);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = payments::EIntentExpired)]
    fun pay_fails_when_intent_has_expired() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        create_intent(&mut scenario, credential_id, &clock);

        // Push the clock past the intent's expiry.
        clock::increment_for_testing(&mut clock, EXPIRY_MS + 1);

        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = payments::EIntentAlreadyPaid)]
    fun pay_fails_when_intent_already_paid() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        create_intent(&mut scenario, credential_id, &clock);

        // First payment succeeds.
        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );
            assert!(payments::intent_is_paid(&intent), 0);

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        // Replaying it must hit our own paid flag, not Payment Kit's duplicate
        // detection, so the on-screen reason is legible.
        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun pay_succeeds_and_delivers_funds_to_the_merchant() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        create_intent(&mut scenario, credential_id, &clock);

        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            assert!(!payments::intent_is_paid(&intent), 0);
            assert!(payments::intent_amount(&intent) == AMOUNT, 1);
            assert!(payments::intent_amount_myr(&intent) == AMOUNT_MYR, 2);

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            assert!(payments::intent_is_paid(&intent), 3);

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        // The merchant's payout address must hold the coin. This is what makes
        // the non-custodial claim true: the funds went wallet to wallet and did
        // not accumulate inside the registry.
        ts::next_tx(&mut scenario, PAYOUT_A);
        {
            let received = ts::take_from_address<Coin<SUI>>(&scenario, PAYOUT_A);
            assert!(coin::value(&received) == AMOUNT, 4);
            ts::return_to_address(PAYOUT_A, received);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun payer_owns_a_receipt_after_paying() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        create_intent(&mut scenario, credential_id, &clock);

        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<SUI>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        // The payer, not the merchant and not the registry, owns the receipt.
        ts::next_tx(&mut scenario, PAYER);
        {
            let receipt = ts::take_from_sender<SuiSureReceipt>(&scenario);
            assert!(payments::receipt_payer(&receipt) == PAYER, 0);
            assert!(payments::receipt_merchant(&receipt) == PAYOUT_A, 1);
            assert!(payments::receipt_amount(&receipt) == AMOUNT, 2);
            ts::return_to_sender(&scenario, receipt);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    #[test]
    #[expected_failure(abort_code = payments::ECoinTypeMismatch)]
    fun pay_fails_with_the_wrong_coin_type() {
        let mut scenario = begin();
        let credential_id = register(&mut scenario, b"Kopitiam Seri Damai", PAYOUT_A);
        let mut clock = new_clock(&mut scenario);
        // The request is created for SUI.
        create_intent(&mut scenario, credential_id, &clock);

        // Paying it with a different coin of the same numeric value must abort.
        // Payment Kit only checks that the coin's value equals the amount, never
        // its type, so this assert is the only thing standing between a merchant
        // and being paid in a token somebody minted for free.
        ts::next_tx(&mut scenario, PAYER);
        {
            let credential =
                ts::take_shared_by_id<MerchantCredential>(&scenario, credential_id);
            let mut intent = ts::take_shared<PaymentIntent>(&scenario);
            let mut registry = ts::take_shared<PaymentRegistry>(&scenario);
            let coin = coin::mint_for_testing<WORTHLESS>(AMOUNT, ts::ctx(&mut scenario));

            payments::pay_payment_intent<WORTHLESS>(
                &credential,
                &mut intent,
                &mut registry,
                coin,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(registry);
            ts::return_shared(intent);
            ts::return_shared(credential);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
