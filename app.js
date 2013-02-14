(function() {
  return {
    childRegex: /child_of:(\d*)/,
    parentRegex: /(?:father_of|parent_of):(\d*)/,
    descriptionDelimiter: '\n--- Original Description --- \n',

    events: {
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      'createChildTicket.done'          : 'createChildTicketDone',
      'createChildTicket.fail'          : 'createChildTicketFail',
      'fetchTicket.done'                : 'fetchTicketDone',
      'fetchGroupsAndUsers.done'        : 'fetchGroupsAndUsersDone',
      'fetchGroupsAndUsers.fail'        : 'fetchGroupsAndUsersFail',
      'click #new-linked-ticket'        : 'displayForm',
      'click #create-linked-ticket'     : 'create',
      'click #copy_description'         : 'copyDescription',
      'click #copy_requester'           : 'copyRequester',
      'change #group'                   : 'groupChanged'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: ticket,
          type: 'POST'
        };
      },
      updateCurrentTicket: function(data){
        return {
          url: '/api/v2/tickets/'+ this.ticket().id() +'.json',
          dataType: 'json',
          data: data,
          type: 'PUT'
        };
      },
      fetchTicket: function(id){
        return {
          url: '/api/v2/tickets/' + id + '.json?include=groups,users',
          dataType: 'json',
          type: 'GET'
        };
      },
      autocompleteRequester: function(email){
        return {
          url: '/api/v2/users/autocomplete.json?email=' + email,
          type: 'POST'
        };
      },
      fetchGroupsAndUsers: function(){
        return {
          url: '/api/v2/group_memberships.json?include=users,groups',
          type: 'GET'
        };
      }
    },

    onActivated: function(data) {
      this.doneLoading = false;

      this.ticketFields("custom_field_" + this.settings.data_field).hide();

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
        !!_.isEmpty(this.ticket().id())){

        if (this.hasChild() || this.hasParent())
          return this.ajax('fetchTicket', this.childID() || this.parentID());

        this.ajax('fetchGroupsAndUsers');

        this.switchTo('home');

        this.doneLoading = true;
      }
    },

    fetchTicketDone: function(data){
      var assignee = _.find(data.users, function(user){
        return user.id == data.ticket.assignee_id;
      });

      var custom_field = _.find(data.ticket.custom_fields, function(field){
        return field.id == this.settings.data_field;
      }, this);

      var is_child = this.childRegex.test(custom_field.value);

      var group = _.find(data.groups, function(item){
        return item.id == data.ticket.group_id;
      });

      if (assignee)
        assignee = assignee.name;

      this.switchTo('has_relation', { ticket: data.ticket,
                                      is_child: is_child,
                                      assignee: assignee,
                                      group: group
                                    });
    },

    displayForm: function(event){
      event.preventDefault();

      this.switchTo('form');

      this.fillGroups();

      this.bindAutocompleteOnRequesterEmail();
    },

    create: function(event){
      event.preventDefault();

      if (this.validate()){
        this.spin();
        this.ajax('createChildTicket', this.childTicketAsJson());
      }
    },

    validate: function(){
      var fields = [ 'subject','description' ],
        isValid = true;

      _.each(fields, function(field){
        if (!this.validateField(field, isValid))
          isValid = false;
      }, this);

      return isValid;
    },

    createChildTicketDone: function(data){
      var field = {};
      var value = "parent_of:" + data.ticket.id;

      this.ticket().customField("custom_field_" + this.settings.data_field,
                                value
                               );

      field[this.settings.data_field] = value;

      this.ajax('updateCurrentTicket', { "ticket": { "fields": field }});

      this.ajax('fetchTicket', data.ticket.id);

      this.unSpin();
    },

    createChildTicketFail: function(data){
      services.notify(this.I18n.t('ticket_creation_failed'), 'error');
      this.unSpin();
    },

    copyDescription: function(){
      var sDescription = this.$('#description').val().split(this.descriptionDelimiter);
      var ret = sDescription[0];

      if (sDescription.length === 1)
        ret += this.descriptionDelimiter + this.ticket().description();

      this.$('#description').val(ret);
    },

    copyRequester: function(){
      this.$('#requester_fields').toggle();
    },

    bindAutocompleteOnRequesterEmail: function(){
      var self = this;

      this.$('#requester_email').autocomplete({
        minLength: 3,
        source: function(request, response) {
          self.ajax('autocompleteRequester', request.term).done(function(data){
            response(_.map(data.users, function(user){
              return {"label": user.email, "value": user.email};
            }));
          });
        }
      });
    },

    fetchGroupsAndUsersDone: function(data){
      this.users = data.users;
      this.groups = data.groups;
      this.group_memberships = data.group_memberships;
    },

    fetchGroupsAndUsersFail: function(){
      services.notify(this.I18n.t('fetch_groups_and_users_failed'), 'error');
    },

    // Private... I guess.

    fillGroups: function(){
      this.$('#group').html(this.optionsFor(this.groups));
    },

    fillUserSelect: function(users){
      this.$('#assignee').html(this.optionsFor(users));
    },

    groupChanged: function(){
      var group_id = Number(this.$('#group').val());
      var users = [];

      this.spin();

      if (_.isFinite(group_id)){
        var user_ids = this.group_memberships
          .filter(function(membership) {
            return membership.group_id == group_id;
          })
          .map(function(membership){
            return membership.user_id;
          });

        users = this.users.filter(function(user){
          return user_ids.contains(user.id);
        });
        this.$('#assignee-group').show();
      } else {
        this.$('#assignee-group').hide();
      }

      this.fillUserSelect(users);

      this.unSpin();
    },

    optionsFor: function(collection){
      var options = '<option>-</option>';

      _.each(collection, function(item){
        options += '<option value="'+item.id+'">'+item.name+'</option>';
      });

      return options;
    },

    validateField: function(field){
      var fieldSelector = '#' +field,
      valid = false;

      if (_.isEmpty(this.$(fieldSelector).val())){
        this.$(fieldSelector).parent('.control-group').addClass('error');
      } else {
        this.$(fieldSelector).parent('.control-group').removeClass('error');
        valid = true;
      }
      return valid;
    },
    childTicketAsJson: function(){
      var params = {
        "subject": this.$('#subject').val(),
        "description": this.$('#description').val(),
        "fields": {}
      };
      var group_id = Number(this.$('#group').val());
      var assignee_id = Number(this.$('#assignee').val());

      if (!_.isEmpty(this.settings.child_tag))
        params.tags = [ this.settings.child_tag ];

      if (this.$('#copy_requester').is(':checked')){
        params.requester_id = this.ticket().requester().id();
      } else {
        params.requester = {
          "email": this.$('#requester_email').val(),
          "name": this.$('#requester_name').val()
        };
      }

      if (_.isFinite(group_id))
        params.group_id = group_id;

      if (_.isFinite(assignee_id))
        params.assignee_id = assignee_id;

      params.fields[this.settings.data_field] = 'child_of:' + this.ticket().id();

      return { "ticket": params };
    },
    dataField: function(){
      return this.ticket().customField("custom_field_" + this.settings.data_field);
    },
    hasChild: function(){
      return this.parentRegex.test(this.dataField());
    },
    hasParent: function(){
      return this.childRegex.test(this.dataField());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.parentRegex.exec(this.dataField())[1];
    },
    parentID: function(){
      if (!this.hasParent())
        return;

      return this.childRegex.exec(this.dataField())[1];
    },
    spin: function(){
      this.$('#spinner').show();
    },
    unSpin: function(){
      this.$('#spinner').hide();
    }
  };
}());
