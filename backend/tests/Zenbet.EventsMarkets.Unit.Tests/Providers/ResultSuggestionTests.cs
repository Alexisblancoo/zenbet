namespace Zenbet.EventsMarkets.Unit.Tests.Providers;

using MediatR;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.ResultProposals;
using Zenbet.EventsMarkets.Application.Commands.SettleFight;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Providers.ApiSports;
using Zenbet.EventsMarkets.Infrastructure.Providers.BigBalls;
using Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

public sealed class ResultReconcilerTests
{
    private static readonly DateTimeOffset T = DateTimeOffset.Parse("2026-11-08T01:00:00Z");

    private static string Read(string folder, string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", folder, name));

    private static FightResultSnapshot Snap(string provider, string a, string b, string? winner, FightOutcomeStatus status = FightOutcomeStatus.Completed,
        string? method = null, int? round = null) =>
        new(provider, "e", $"{provider}-{a}-{b}", a, b, winner, status, method, method, round, null, T);

    private static ResultReconciliation Run(params (string Provider, FightResultSnapshot[]? Snaps)[] feeds) =>
        ResultReconciler.Reconcile("Red Fighter", "Blue Fighter", T, 3,
            feeds.Select(f => new ProviderObservation(f.Provider, f.Snaps)).ToList());

    [Fact]
    public void Real_card_of_2026_11_07_is_classified_bout_by_bout()
    {
        var primary = UfCalendarParser.ParseResults(Read("UfCalendar", "event-results-2026-11-07.json"));
        var apiSports = ApiSportsParser.ParseFights(Read("ApiSports", "fights-2026-11-07.json"))
            .Concat(ApiSportsParser.ParseFights(Read("ApiSports", "fights-2026-11-08.json"))).ToList();
        var bigBalls = BigBallsParser.ParseMatches(Read("BigBalls", "matches-2026-11-07.json"))
            .Concat(BigBallsParser.ParseMatches(Read("BigBalls", "matches-2026-11-08.json"))).ToList();

        var results = primary.Select(p => (Bout: p, Outcome: ResultReconciler.Reconcile(p.FighterAName, p.FighterBName, p.EventStart, 3,
            new[]
            {
                new ProviderObservation("UFCalendar", primary),
                new ProviderObservation("API-Sports", apiSports),
                new ProviderObservation("BigBallsData", bigBalls),
            }))).ToList();

        Assert.True(results.Count(r => r.Outcome.Status == ProposalStatus.Verified) == 14,
            string.Join(" || ", results.Where(r => r.Outcome.Status != ProposalStatus.Verified && r.Outcome.Status != ProposalStatus.CancelledSuggested)
                .Select(r => $"{r.Bout.FighterAName} vs {r.Bout.FighterBName}: {r.Outcome.Status} {r.Outcome.Detail} [{r.Outcome.SourcesSummary}]")));
        Assert.Equal(4, results.Count(r => r.Outcome.Status == ProposalStatus.CancelledSuggested));
        Assert.DoesNotContain(results, r => r.Outcome.Status == ProposalStatus.Conflict);

        // Decisions are corroborated on method by Big Balls; finishes (KO/submission) are single-source on method.
        Assert.All(results.Where(r => r.Outcome.Status == ProposalStatus.Verified && r.Bout.MethodNormalized!.StartsWith("decision")),
            r => Assert.True(r.Outcome.MethodCorroborated, r.Bout.FighterAName));
        Assert.All(results.Where(r => r.Outcome.Status == ProposalStatus.Verified && !r.Bout.MethodNormalized!.StartsWith("decision")),
            r => Assert.False(r.Outcome.MethodCorroborated, r.Bout.FighterAName));

        var main = results.Single(r => r.Bout.FighterAName == "Waldo Cortes Acosta");
        Assert.Equal(FightCorner.Blue, main.Outcome.WinnerCorner); // Johnny Walker
        Assert.Equal(MmaVictoryMethod.Knockout, main.Outcome.Method);
        Assert.Equal(3, main.Outcome.Round);
    }

    [Fact]
    public void Primary_alone_is_only_pending()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 2)]), ("B", []));

        Assert.Equal(ProposalStatus.Pending, r.Status);
        Assert.Contains("segunda fuente", r.Detail);
    }

    [Fact]
    public void Second_source_that_is_down_never_verifies()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 2)]), ("B", null));

        Assert.Equal(ProposalStatus.Pending, r.Status);
    }

    [Fact]
    public void Two_sources_agreeing_on_winner_verify_with_method_flagged_single_source()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Blue Fighter", method: "submission", round: 1)]),
                    ("B", [Snap("B", "Blue Fighter", "Red Fighter", "Blue Fighter")]));

        Assert.Equal(ProposalStatus.Verified, r.Status);
        Assert.Equal(FightCorner.Blue, r.WinnerCorner);
        Assert.Equal(MmaVictoryMethod.Submission, r.Method);
        Assert.False(r.MethodCorroborated);
    }

    [Fact]
    public void Winner_disagreement_is_a_conflict_never_a_guess()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 2)]),
                    ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Blue Fighter")]));

        Assert.Equal(ProposalStatus.Conflict, r.Status);
    }

    [Fact]
    public void Method_disagreement_is_a_conflict()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 2)]),
                    ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter", method: "unanimous_decision")]));

        Assert.Equal(ProposalStatus.Conflict, r.Status);
        Assert.Contains("método", r.Detail);
    }

    [Theory]
    [InlineData("split_draw")]
    [InlineData("no_contest")]
    [InlineData("dq")]
    [InlineData("overturned")]
    public void Outcomes_we_cannot_settle_need_a_human(string method)
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: method, round: 3)]),
                    ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));

        Assert.Equal(ProposalStatus.Conflict, r.Status);
    }

    [Fact]
    public void Winner_who_is_not_in_the_bout_is_a_conflict()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Somebody Else", method: "ko_tko", round: 1)]),
                    ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));

        Assert.Equal(ProposalStatus.Conflict, r.Status);
    }

    [Fact]
    public void Cancelled_bout_is_suggested_for_voiding_not_settled()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", null, FightOutcomeStatus.Cancelled)]), ("B", []));

        Assert.Equal(ProposalStatus.CancelledSuggested, r.Status);
        Assert.Null(r.WinnerCorner);
    }

    [Fact]
    public void Bout_not_finished_yet_stays_pending()
    {
        var r = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", null, FightOutcomeStatus.Scheduled)]), ("B", []));

        Assert.Equal(ProposalStatus.Pending, r.Status);
    }

    [Fact]
    public void Decision_without_round_uses_the_scheduled_rounds_but_a_finish_without_round_is_a_conflict()
    {
        var decision = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "decision_unanimous")]),
                           ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));
        var finish = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko")]),
                         ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));

        Assert.Equal(3, decision.Round);
        Assert.Equal(ProposalStatus.Verified, decision.Status);
        Assert.Equal(ProposalStatus.Conflict, finish.Status);
    }

    [Fact]
    public void Result_that_does_not_fit_our_scheduled_rounds_is_a_conflict()
    {
        // Our bout is scheduled for 3 rounds (Run helper); the feed says the decision came in round 5 / a KO in round 4.
        var longDecision = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "decision_unanimous", round: 5)]),
                               ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));
        var koAfterEnd = Run(("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 4)]),
                             ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));
        var shortDecision = ResultReconciler.Reconcile("Red Fighter", "Blue Fighter", T, 5,
            [new ProviderObservation("A", [Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "decision_unanimous", round: 3)]),
             new ProviderObservation("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")])]);

        Assert.Equal(ProposalStatus.Conflict, longDecision.Status);
        Assert.Equal(ProposalStatus.Conflict, koAfterEnd.Status);
        Assert.Equal(ProposalStatus.Conflict, shortDecision.Status);
        Assert.Contains("programad", shortDecision.Detail);
    }

    [Fact]
    public void Ambiguous_listing_is_treated_as_not_listed()
    {
        var dup = new[]
        {
            Snap("A", "Red Fighter", "Blue Fighter", "Red Fighter", method: "ko_tko", round: 1),
            Snap("A", "Blue Fighter", "Red Fighter", "Blue Fighter", method: "ko_tko", round: 1),
        };
        var r = Run(("A", dup), ("B", [Snap("B", "Red Fighter", "Blue Fighter", "Red Fighter")]));

        Assert.Equal(ProposalStatus.Pending, r.Status);
    }
}

public sealed class SecondarySourceParserTests
{
    private static string Read(string folder, string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", folder, name));

    [Fact]
    public void ApiSports_gives_winner_and_status_but_never_a_method()
    {
        var fights = ApiSportsParser.ParseFights(Read("ApiSports", "fights-2026-11-07.json"));

        Assert.NotEmpty(fights);
        Assert.All(fights, f => Assert.Null(f.Method));
        Assert.Contains(fights, f => f.Status == FightOutcomeStatus.Cancelled && f.WinnerName is null);
        Assert.All(fights.Where(f => f.Status == FightOutcomeStatus.Completed), f => Assert.NotNull(f.WinnerName));
    }

    [Theory]
    [InlineData("Gabriel LorenÃ§o", "Gabriel Lorenço")]
    [InlineData("Nina MiloÅ¡evic", "Nina Miloševic")]
    [InlineData("Plain Name", "Plain Name")]
    [InlineData("Already Lorenço", "Already Lorenço")]
    public void ApiSports_double_encoded_names_are_repaired_and_clean_names_untouched(string input, string expected) =>
        Assert.Equal(expected, ApiSportsParser.RepairMojibake(input));

    [Fact]
    public void BigBalls_gives_winner_and_method_only_for_decisions()
    {
        var matches = BigBallsParser.ParseMatches(Read("BigBalls", "matches-2026-11-08.json"));

        var decision = Assert.Single(matches, m => m.FighterBName == "Tatiana Suarez" || m.FighterAName == "Tatiana Suarez");
        Assert.Equal("Tatiana Suarez", decision.WinnerName);
        Assert.Equal("unanimous_decision", decision.MethodNormalized);
        var finish = Assert.Single(matches, m => m.FighterAName == "Johnny Walker");
        Assert.Null(finish.WinnerName);
        Assert.Equal(FightOutcomeStatus.Completed, finish.Status);
    }

    [Fact]
    public void Fixtures_contain_no_credentials()
    {
        foreach (var folder in new[] { "ApiSports", "BigBalls", "UfCalendar" })
            foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Fixtures", folder), "*.json"))
            {
                var text = File.ReadAllText(file);
                Assert.DoesNotContain("bbs_live_", text);
                Assert.DoesNotContain("ufcalendar_", text);
            }
    }
}

public sealed class ResultProposalWorkflowTests
{
    private sealed class FakeRepo : IFightResultProposalRepository
    {
        public Dictionary<Guid, FightResultProposal> Items { get; } = new();
        public int Saves { get; private set; }
        public Task<FightResultProposal?> GetAsync(Guid id, CancellationToken ct = default) => Task.FromResult(Items.GetValueOrDefault(id));
        public Task<IReadOnlyList<ResultProposalView>> ListAsync(ProposalStatus? status, int take, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<ResultProposalView>>([]);
        public Task<IReadOnlyDictionary<Guid, FightResultProposal>> GetByEventIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyDictionary<Guid, FightResultProposal>>(Items.Values.Where(p => ids.Contains(p.EventId)).ToDictionary(p => p.EventId));
        public void Add(FightResultProposal p) => Items[p.Id] = p;
        public Task SaveChangesAsync(CancellationToken ct = default) { Saves++; return Task.CompletedTask; }
    }

    private sealed class FakeSender : ISender
    {
        public List<SettleFightCommand> Sent { get; } = new();
        public Exception? Throw { get; set; }

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default)
        {
            var cmd = (SettleFightCommand)(object)request;
            Sent.Add(cmd);
            if (Throw is not null) throw Throw;
            object result = new SettleUfcEventResult(cmd.EventId.Value, "x", cmd.WinnerCorner.ToString(), cmd.Method.ToString(), cmd.Round, "Finished", false, []);
            return Task.FromResult((TResponse)result);
        }

        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest => throw new NotSupportedException();
        public Task<object?> Send(object request, CancellationToken ct = default) => throw new NotSupportedException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default) => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default) => throw new NotSupportedException();
    }

    private static FightResultProposal Make(ProposalStatus status, bool corroborated = true)
    {
        var p = new FightResultProposal(Guid.NewGuid(), DateTimeOffset.UtcNow);
        p.Update(status, FightCorner.Blue, MmaVictoryMethod.Knockout, 2, corroborated, "d", "s", DateTimeOffset.UtcNow);
        return p;
    }

    private static (ConfirmResultProposalCommandHandler Handler, FakeRepo Repo, FakeSender Sender) Setup(FightResultProposal p)
    {
        var repo = new FakeRepo();
        repo.Items[p.Id] = p;
        var sender = new FakeSender();
        return (new ConfirmResultProposalCommandHandler(repo, sender), repo, sender);
    }

    [Fact]
    public async Task Confirming_a_verified_corroborated_proposal_settles_once_and_closes_it()
    {
        var p = Make(ProposalStatus.Verified);
        var (handler, repo, sender) = Setup(p);

        var result = await handler.Handle(new ConfirmResultProposalCommand(p.Id, "admin:ana", false, "ok"), default);

        var sent = Assert.Single(sender.Sent);
        Assert.Equal(p.EventId, sent.EventId.Value);
        Assert.Equal(FightCorner.Blue, sent.WinnerCorner);
        Assert.Equal("admin:ana", sent.SettledBy);
        Assert.NotNull(sent.IdempotencyKey);
        Assert.Equal("Blue", result.WinnerCorner);
        Assert.Equal(ProposalStatus.Applied, p.Status);
        Assert.Equal("admin:ana", p.ReviewedBy);
        Assert.Equal(1, repo.Saves);
    }

    [Fact]
    public async Task Idempotency_key_is_stable_for_the_same_proposal()
    {
        var p = Make(ProposalStatus.Verified);
        var (handler, _, sender) = Setup(p);
        sender.Throw = new InvalidOperationException("boom");
        await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", false, null), default));
        sender.Throw = null;
        await handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", false, null), default);

        Assert.Equal(2, sender.Sent.Count);
        Assert.Equal(sender.Sent[0].IdempotencyKey, sender.Sent[1].IdempotencyKey);
    }

    [Theory]
    [InlineData(ProposalStatus.Pending)]
    [InlineData(ProposalStatus.Conflict)]
    [InlineData(ProposalStatus.CancelledSuggested)]
    [InlineData(ProposalStatus.Applied)]
    [InlineData(ProposalStatus.Dismissed)]
    public async Task Only_verified_proposals_can_be_confirmed(ProposalStatus status)
    {
        var p = Make(ProposalStatus.Pending);
        if (status == ProposalStatus.Applied) { p.Update(ProposalStatus.Verified, FightCorner.Red, MmaVictoryMethod.Decision, 3, true, "d", "s", DateTimeOffset.UtcNow); p.MarkApplied("a", null, DateTimeOffset.UtcNow); }
        else if (status == ProposalStatus.Dismissed) p.Dismiss("a", "no", DateTimeOffset.UtcNow);
        else p.Update(status, FightCorner.Red, MmaVictoryMethod.Decision, 3, true, "d", "s", DateTimeOffset.UtcNow);
        var (handler, _, sender) = Setup(p);

        await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", true, null), default));
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task Single_source_method_requires_explicit_acknowledgement()
    {
        var p = Make(ProposalStatus.Verified, corroborated: false);
        var (handler, _, sender) = Setup(p);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", false, null), default));
        Assert.Contains("una sola fuente", ex.Message);
        Assert.Empty(sender.Sent);

        await handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", true, null), default);
        Assert.Single(sender.Sent);
    }

    [Fact]
    public async Task A_failed_settlement_leaves_the_proposal_verified_and_retryable()
    {
        var p = Make(ProposalStatus.Verified);
        var (handler, repo, sender) = Setup(p);
        sender.Throw = new InvalidOperationException("event already settled");

        await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(new ConfirmResultProposalCommand(p.Id, "a", false, null), default));

        Assert.Equal(ProposalStatus.Verified, p.Status);
        Assert.Equal(0, repo.Saves);
    }

    [Fact]
    public async Task Unknown_proposal_is_not_found()
    {
        var (handler, _, _) = Setup(Make(ProposalStatus.Verified));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => handler.Handle(new ConfirmResultProposalCommand(Guid.NewGuid(), "a", false, null), default));
    }

    [Fact]
    public void Feed_refresh_never_overwrites_an_admin_decision()
    {
        var p = Make(ProposalStatus.Verified);
        p.Dismiss("admin", "wrong data", DateTimeOffset.UtcNow);

        var changed = p.Update(ProposalStatus.Conflict, null, null, null, false, "x", "y", DateTimeOffset.UtcNow);

        Assert.False(changed);
        Assert.Equal(ProposalStatus.Dismissed, p.Status);
    }

    [Fact]
    public void Dismiss_requires_a_reason_and_applied_cannot_be_forced_by_the_feed()
    {
        var p = Make(ProposalStatus.Pending);
        Assert.Throws<ArgumentException>(() => p.Dismiss("admin", " ", DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => p.Update(ProposalStatus.Applied, null, null, null, false, "x", "y", DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Dismissing_records_who_and_why()
    {
        var p = Make(ProposalStatus.Conflict);
        var repo = new FakeRepo();
        repo.Items[p.Id] = p;

        await new DismissResultProposalCommandHandler(repo).Handle(new DismissResultProposalCommand(p.Id, "admin:ana", "datos del proveedor erróneos"), default);

        Assert.Equal(ProposalStatus.Dismissed, p.Status);
        Assert.Equal("admin:ana", p.ReviewedBy);
        Assert.Equal("datos del proveedor erróneos", p.ReviewNote);
    }
}
