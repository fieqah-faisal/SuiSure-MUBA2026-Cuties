#[test_only]
module suisure::payments_tests {
    use std::string;
    use sui::test_scenario as ts;
    use suisure::payments::{Self, AdminCap, MerchantCredential};

    const ADMIN: address = @0xAD;
    const PAYOUT: address = @0xB0B;

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
                PAYOUT,
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
            assert!(payments::payout(&credential) == PAYOUT, 2);
            assert!(payments::is_active(&credential), 3);
            ts::return_shared(credential);
        };

        ts::end(scenario);
    }
}
