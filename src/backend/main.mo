import Map "mo:core/Map";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Float "mo:core/Float";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  public type TradeAnalysis = {
    id : Nat;
    ticker : Text;
    inputData : InputData;
    result : TradeSetupResult;
    timestamp : Time.Time;
  };

  public type InputData = {
    entryPrice : Float;
    stopLossPrice : Float;
    takeProfitPrice : Float;
    riskAmount : Float;
  };

  public type TradeSetupResult = {
    positionSize : Float;
    riskRewardRatio : Float;
    explanation : Text;
  };

  module TradeAnalysis {
    public func compareByTimestamp(a : TradeAnalysis, b : TradeAnalysis) : Order.Order {
      Int.compare(b.timestamp, a.timestamp);
    };
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let tradesByUser = Map.empty<Principal, List.List<TradeAnalysis>>();
  var nextId = 0;

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func analyzeTrade(_ticker : Text, entryPrice : Float, stopLossPrice : Float, takeProfitPrice : Float, riskAmount : Float) : async TradeSetupResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can analyze trades");
    };

    let positionSize = riskAmount / (entryPrice - stopLossPrice);
    let riskRewardRatio = (takeProfitPrice - entryPrice) / (entryPrice - stopLossPrice);

    let explanation = "Position size is calculated as risk amount divided by the difference between entry price and stop loss price. Risk/reward ratio is calculated as the difference between take profit and entry price, divided by the difference between entry price and stop loss price.";

    let result : TradeSetupResult = {
      positionSize;
      riskRewardRatio;
      explanation;
    };

    let tradeAnalysis : TradeAnalysis = {
      id = nextId;
      ticker = _ticker;
      inputData = {
        entryPrice;
        stopLossPrice;
        takeProfitPrice;
        riskAmount;
      };
      result;
      timestamp = Time.now();
    };

    switch (tradesByUser.get(caller)) {
      case (null) {
        tradesByUser.add(caller, List.singleton<TradeAnalysis>(tradeAnalysis));
      };
      case (?existingTrades) {
        existingTrades.add(tradeAnalysis);
      };
    };

    nextId += 1;
    result;
  };

  public query ({ caller }) func getTradeHistory() : async [TradeAnalysis] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trade history");
    };

    switch (tradesByUser.get(caller)) {
      case (null) { Runtime.trap("No trade history found") };
      case (?trades) {
        let tradesArray = trades.values().toArray();
        tradesArray.sort(TradeAnalysis.compareByTimestamp);
      };
    };
  };

  public query ({ caller }) func getTradeById(tradeId : Nat) : async TradeAnalysis {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trades");
    };

    switch (tradesByUser.get(caller)) {
      case (null) { Runtime.trap("No trades found for user") };
      case (?trades) {
        let filtered = trades.filter(func(t) { t.id == tradeId });
        switch (filtered.size()) {
          case (0) { Runtime.trap("Trade not found") };
          case (_) { filtered.values().toArray()[0] };
        };
      };
    };
  };
};
