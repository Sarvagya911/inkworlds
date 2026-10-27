package com.sarvagya.inkworlds;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (getBridge() != null &&
                        getBridge().getWebView() != null) {

                        getBridge().getWebView().evaluateJavascript(
                            "window.__inkworldsGoBack && window.__inkworldsGoBack();",
                            null
                        );
                    }
                }
            }
        );
    }
}